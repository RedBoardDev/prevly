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
	webhookSecret := os.Getenv(cfg.GitHub.WebhookSecretEnv)
	if webhookSecret == "" {
		return fmt.Errorf("webhook secret env %q is not set", cfg.GitHub.WebhookSecretEnv)
	}

	st, err := store.Open(storePath(cfg))
	if err != nil {
		return err
	}
	defer st.Close()

	app, err := github.NewAppFromFile(cfg.GitHub.AppID, cfg.GitHub.PrivateKeyPath)
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
	proxy.SetControlHandler(controlMux(webhookSecret, rec, logger))

	logger.Info("prevly daemon starting", "version", version, "base_domain", cfg.BaseDomain)

	errCh := make(chan error, 2)
	go func() { errCh <- proxy.Run(ctx) }()
	go func() { errCh <- rec.Run(ctx, reconcileInterval) }()

	select {
	case <-ctx.Done():
		logger.Info("prevly daemon stopping")
		return nil
	case err := <-errCh:
		return err
	}
}

func controlMux(webhookSecret string, h github.EventHandler, logger *applog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/webhook", github.NewWebhookHandler(webhookSecret, h, logger))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	return mux
}
