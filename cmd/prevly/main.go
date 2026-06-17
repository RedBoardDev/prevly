// Command prevly is the single-binary daemon + CLI for per-PR preview
// environments.
package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	applog "github.com/RedBoardDev/prevly/internal/log"
)

// Build metadata, overridable via -ldflags at release time.
var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

type globalFlags struct {
	configPath string
	logLevel   string
	logJSON    bool
}

func main() {
	if err := newRootCmd().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func newRootCmd() *cobra.Command {
	g := &globalFlags{}
	root := &cobra.Command{
		Use:           "prevly",
		Short:         "Per-PR preview environments on your own Docker host",
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.PersistentFlags().StringVar(&g.configPath, "config", defaultConfigPath(), "host config file")
	root.PersistentFlags().StringVar(&g.logLevel, "log-level", "info", "log level (debug|info|warn|error)")
	root.PersistentFlags().BoolVar(&g.logJSON, "log-json", false, "emit JSON logs")

	root.AddCommand(
		newRunCmd(g),
		newInitCmd(g),
		newSecretCmd(g),
		newStatusCmd(g),
		newDestroyCmd(g),
		newDoctorCmd(g),
		newVersionCmd(),
	)
	return root
}

func (g *globalFlags) logger() *applog.Logger {
	return applog.New(applog.Options{Level: g.logLevel, JSON: g.logJSON})
}

func defaultConfigPath() string {
	if p := os.Getenv("PREVLY_CONFIG"); p != "" {
		return p
	}
	return "/etc/prevly/config.yaml"
}
