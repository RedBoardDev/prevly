package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

const scaffoldPrevlyYML = `version: 1

# Which PRs get previews. Previews are per-PR; a base branch is never previewed.
triggers:
  target_branches: [main]
  exclude_head_branches: ["dependabot/**"]

# One or more apps. Each deploys ONLY when the PR touches files in its paths.
apps:
  - name: web
    paths:
      - "**"            # narrow this to your app's directory in a monorepo
    dockerfile: Dockerfile
    context: "."
    # subdomain: web    # required only in multi-app repos
    port: 3000
    build_args: {}
    env: {}
    secrets: []

ttl: 30d
idle: 6h
`

func newInitCmd(_ *globalFlags) *cobra.Command {
	var force bool
	cmd := &cobra.Command{
		Use:   "init",
		Short: "Scaffold a .prevly.yml in the current repository",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			dir, err := os.Getwd()
			if err != nil {
				return err
			}
			target := filepath.Join(dir, ".prevly.yml")
			if _, err := os.Stat(target); err == nil && !force {
				return fmt.Errorf("%s already exists (use --force to overwrite)", target)
			}
			if err := os.WriteFile(target, []byte(scaffoldPrevlyYML), 0o644); err != nil {
				return fmt.Errorf("write %s: %w", target, err)
			}
			fmt.Fprintf(cmd.OutOrStdout(), "wrote %s\n", target)
			return nil
		},
	}
	cmd.Flags().BoolVar(&force, "force", false, "overwrite an existing .prevly.yml")
	return cmd
}
