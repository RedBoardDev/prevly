package main

import (
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/spf13/cobra"

	"github.com/RedBoardDev/prevly/internal/config"
)

// In v1, secrets are resolved from the daemon's environment by name (see
// docs/decisions.md #9). The `secret` command therefore inspects the host
// config's secret table and reports which referenced env vars are present.
func newSecretCmd(g *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "secret",
		Short: "Inspect the daemon secret table (env-backed in v1)",
	}
	cmd.AddCommand(newSecretListCmd(g))
	return cmd
}

func newSecretListCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List declared secrets and whether their env var is set",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			cfg, err := config.LoadHostConfig(g.configPath)
			if err != nil {
				return err
			}
			w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 2, 2, ' ', 0)
			fmt.Fprintln(w, "NAME\tREFERENCE\tSTATUS")
			for name, ref := range cfg.Secrets {
				status := "unresolved"
				if scheme, varName, ok := strings.Cut(ref, ":"); ok && scheme == "env" {
					if _, present := os.LookupEnv(varName); present {
						status = "set"
					} else {
						status = "MISSING"
					}
				}
				fmt.Fprintf(w, "%s\t%s\t%s\n", name, ref, status)
			}
			return w.Flush()
		},
	}
}
