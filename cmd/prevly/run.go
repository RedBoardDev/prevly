package main

import (
	"context"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"

	"github.com/RedBoardDev/prevly/internal/config"
	applog "github.com/RedBoardDev/prevly/internal/log"
)

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

// runDaemon is the daemon entrypoint; wired to the reconciler, webhook server
// and ingress in M5.
func runDaemon(ctx context.Context, logger *applog.Logger, cfg *config.HostConfig) error {
	_ = cfg
	logger.Info("prevly daemon starting", "version", version)
	<-ctx.Done()
	logger.Info("prevly daemon stopping")
	return nil
}
