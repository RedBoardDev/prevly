package main

import (
	"fmt"
	"os"
	"strconv"

	"github.com/spf13/cobra"

	"github.com/RedBoardDev/prevly/internal/config"
	"github.com/RedBoardDev/prevly/internal/reconcile"
	"github.com/RedBoardDev/prevly/internal/runtime"
	"github.com/RedBoardDev/prevly/internal/secrets"
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

			rec := reconcile.New(reconcile.Deps{
				Config:  cfg,
				Store:   st,
				Runtime: runtime.New(),
				Secrets: secrets.New(cfg.Secrets, os.LookupEnv),
				Logger:  g.logger(),
			})
			n, err := rec.Teardown(cmd.Context(), repo, pr, app)
			if err != nil {
				return err
			}
			if n == 0 {
				return fmt.Errorf("no previews found for %s#%d", repo, pr)
			}
			fmt.Fprintf(cmd.OutOrStdout(), "destroyed %d preview(s) for %s#%d\n", n, repo, pr)
			return nil
		},
	}
}
