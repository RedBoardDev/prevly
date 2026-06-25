package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"github.com/RedBoardDev/prevly/internal/builder"
	"github.com/RedBoardDev/prevly/internal/config"
	"github.com/RedBoardDev/prevly/internal/github"
	"github.com/RedBoardDev/prevly/internal/ingress"
	applog "github.com/RedBoardDev/prevly/internal/log"
	"github.com/RedBoardDev/prevly/internal/reconcile"
	"github.com/RedBoardDev/prevly/internal/runtime"
	"github.com/RedBoardDev/prevly/internal/secrets"
	"github.com/RedBoardDev/prevly/internal/setup"
	"github.com/RedBoardDev/prevly/internal/statusapi"
	"github.com/RedBoardDev/prevly/internal/store"
)

const reconcileInterval = 1 * time.Minute

func newRunCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "run",
		Short: "Run the prevly daemon (foreground; wrap in systemd)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			logger := g.logger()
			cfg, err := config.LoadHostConfig(g.configPath)
			if err != nil {
				return err
			}
			ctx, stop := signal.NotifyContext(cmd.Context(), syscall.SIGINT, syscall.SIGTERM)
			defer stop()
			return runDaemon(ctx, logger, cfg)
		},
	}
}

func runDaemon(ctx context.Context, logger *applog.Logger, cfg *config.HostConfig) error {
	creds, key, ok, err := resolveCredentials(cfg)
	if err != nil {
		return err
	}
	if !ok {
		creds, key, err = runSetupPhase(ctx, logger, cfg)
		if err != nil {
			return err
		}
		if key == nil { // context cancelled before setup completed
			return nil
		}
	}
	return runNormal(ctx, logger, cfg, creds, key)
}

// resolveCredentials finds the GitHub App credentials, preferring an App set
// explicitly in the host config, then the ones persisted by the setup flow.
// ok is false when no App is configured yet (the daemon must enter setup mode).
func resolveCredentials(cfg *config.HostConfig) (setup.Credentials, []byte, bool, error) {
	if cfg.GitHub.AppID != 0 {
		key, err := os.ReadFile(cfg.GitHub.PrivateKeyPath)
		if err != nil {
			return setup.Credentials{}, nil, false, fmt.Errorf("read github app key: %w", err)
		}
		secret := os.Getenv(cfg.GitHub.WebhookSecretEnv)
		if secret == "" {
			return setup.Credentials{}, nil, false, fmt.Errorf("webhook secret env %q is not set", cfg.GitHub.WebhookSecretEnv)
		}
		return setup.Credentials{AppID: cfg.GitHub.AppID, WebhookSecret: secret}, key, true, nil
	}
	return setup.Load(cfg.DataDir)
}

// runSetupPhase serves the in-daemon GitHub App creation flow on the base domain
// until an App is created (then returns its credentials) or ctx is cancelled
// (then returns a nil key). It reuses the embedded proxy for TLS, so the cert it
// obtains is cached for the normal phase.
func runSetupPhase(ctx context.Context, logger *applog.Logger, cfg *config.HostConfig) (setup.Credentials, []byte, error) {
	token, err := setup.NewToken()
	if err != nil {
		return setup.Credentials{}, nil, err
	}
	handler, err := setup.NewHandler(cfg.BaseDomain, cfg.DataDir, token, logger)
	if err != nil {
		return setup.Credentials{}, nil, err
	}

	proxy := ingress.NewProxy(noopResolver{}, cfg, logger)
	proxy.SetControlHandler(handler)

	setupCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	errCh := make(chan error, 1)
	go func() { errCh <- proxy.Run(setupCtx) }()

	logger.Info("no GitHub App configured — open the setup page to create one",
		"url", fmt.Sprintf("https://%s/setup?token=%s", cfg.BaseDomain, token))

	select {
	case <-handler.Done():
		cancel()
		<-errCh // wait for the setup proxy to release :443 before the normal phase
		creds, key, _, err := setup.Load(cfg.DataDir)
		return creds, key, err
	case <-ctx.Done():
		return setup.Credentials{}, nil, nil
	case err := <-errCh:
		return setup.Credentials{}, nil, err
	}
}

func runNormal(ctx context.Context, logger *applog.Logger, cfg *config.HostConfig, creds setup.Credentials, key []byte) error {
	if creds.WebhookSecret == "" {
		return fmt.Errorf("github app webhook secret is empty")
	}

	st, err := store.Open(storePath(cfg))
	if err != nil {
		return err
	}
	defer st.Close()

	app, err := github.NewApp(creds.AppID, key)
	if err != nil {
		return err
	}

	rec := reconcile.New(reconcile.Deps{
		Config:  cfg,
		Store:   st,
		Builder: builder.New(),
		Runtime: runtime.New(),
		Secrets: secrets.New(cfg.Secrets, os.LookupEnv),
		GitHub:  reconcile.NewAppGitHub(app),
		Logger:  logger,
	})

	proxy := ingress.NewProxy(rec, cfg, logger)
	proxy.SetControlHandler(controlMux(ctx, creds.WebhookSecret, rec, logger))

	logger.Info("prevly daemon starting", "version", version, "base_domain", cfg.BaseDomain, "app_id", creds.AppID)

	errCh := make(chan error, 3)
	go func() { errCh <- proxy.Run(ctx) }()
	go func() { errCh <- rec.Run(ctx, reconcileInterval) }()
	// Serve read-only state over a Unix socket so `prevly status` can query the
	// daemon instead of opening the (exclusively locked) store.
	go func() { errCh <- statusapi.Serve(ctx, cfg.DataDir, st, logger) }()

	select {
	case <-ctx.Done():
		logger.Info("prevly daemon stopping")
		return nil
	case err := <-errCh:
		return err
	}
}

// noopResolver is the ingress resolver used during setup, when no previews exist.
type noopResolver struct{}

func (noopResolver) Resolve(context.Context, string) (ingress.Target, bool, error) {
	return ingress.Target{}, false, nil
}

func (noopResolver) Known(string) bool { return false }

func controlMux(ctx context.Context, webhookSecret string, h github.EventHandler, logger *applog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/webhook", github.NewWebhookHandler(ctx, webhookSecret, h, logger))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	return mux
}
