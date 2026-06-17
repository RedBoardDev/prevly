package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/spf13/cobra"

	"github.com/RedBoardDev/prevly/internal/config"
)

func newDoctorCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "doctor",
		Short: "Check Docker access, config, secrets and disk",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			out := cmd.OutOrStdout()
			var problems int
			check := func(name string, err error) {
				if err != nil {
					problems++
					fmt.Fprintf(out, "[FAIL] %s: %v\n", name, err)
					return
				}
				fmt.Fprintf(out, "[ OK ] %s\n", name)
			}
			warn := func(name, msg string) {
				fmt.Fprintf(out, "[WARN] %s: %s\n", name, msg)
			}

			cfg, err := config.LoadHostConfig(g.configPath)
			check("host config", err)
			if err == nil {
				check("data dir writable", checkWritable(cfg.DataDir))
				for name, ref := range cfg.Secrets {
					if looksSecretButPresent(ref) {
						warn("secret "+name, "value present; ensure it is non-prod (previews must carry no prod secrets)")
					}
				}
			}

			check("docker CLI present", checkDocker())
			if rootless, err := dockerRootless(); err == nil && !rootless {
				warn("docker rootless", "Docker is not running rootless; running rootless is recommended")
			}

			if problems > 0 {
				return fmt.Errorf("%d check(s) failed", problems)
			}
			fmt.Fprintln(out, "all checks passed")
			return nil
		},
	}
}

func checkWritable(dir string) error {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	f, err := os.CreateTemp(dir, ".prevly-doctor-*")
	if err != nil {
		return err
	}
	name := f.Name()
	_ = f.Close()
	return os.Remove(name)
}

func checkDocker() error {
	if _, err := exec.LookPath("docker"); err != nil {
		return fmt.Errorf("docker not found in PATH")
	}
	return exec.Command("docker", "version", "--format", "{{.Server.Version}}").Run()
}

func dockerRootless() (bool, error) {
	out, err := exec.Command("docker", "info", "--format", "{{.SecurityOptions}}").Output()
	if err != nil {
		return false, err
	}
	return strings.Contains(string(out), "rootless"), nil
}

func looksSecretButPresent(ref string) bool {
	// Only env: references are resolvable in v1; treat any present one as a hint.
	return strings.HasPrefix(ref, "env:")
}
