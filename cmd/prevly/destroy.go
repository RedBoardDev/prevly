package main

import (
	"context"
	"fmt"
	"strconv"

	"github.com/spf13/cobra"

	"github.com/RedBoardDev/prevly/internal/config"
	applog "github.com/RedBoardDev/prevly/internal/log"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/store"
)

func newDestroyCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "destroy <repo> <pr> [app]",
		Short: "Admin teardown of a PR's previews",
		Args:  cobra.RangeArgs(2, 3),
		RunE: func(cmd *cobra.Command, args []string) error {
			repo := args[0]
			pr, err := strconv.Atoi(args[1])
			if err != nil {
				return fmt.Errorf("pr must be a number: %w", err)
			}
			var app string
			if len(args) == 3 {
				app = args[2]
			}

			cfg, err := config.LoadHostConfig(g.configPath)
			if err != nil {
				return err
			}
			st, err := openStore(cfg)
			if err != nil {
				return err
			}
			defer st.Close()

			return destroyPreviews(cmd.Context(), g.logger(), cfg, st, repo, pr, app)
		},
	}
}

// destroyPreviews tears down a PR's previews. The container/network removal is
// wired to the runtime in M5; here it removes the state records the reconciler
// and proxy route on. Orphaned containers are reaped by the reconciler.
func destroyPreviews(_ context.Context, logger *applog.Logger, _ *config.HostConfig, st *store.Store, repo string, pr int, app string) error {
	previews, err := st.ListByPR(repo, pr)
	if err != nil {
		return err
	}
	var removed int
	for _, p := range previews {
		if app != "" && p.AppName != app {
			continue
		}
		p.Status = model.StatusDestroyed
		if err := st.Delete(p.Repo, p.PRNumber, p.AppName); err != nil {
			return err
		}
		logger.Info("destroyed preview", "repo", repo, "pr", pr, "app", p.AppName)
		removed++
	}
	if removed == 0 {
		return fmt.Errorf("no previews found for %s#%d", repo, pr)
	}
	return nil
}
