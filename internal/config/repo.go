// Package config loads and validates prevly's two configuration files: the
// per-repo `.prevly.yml` (describes the apps) and the host config (describes the
// daemon: domain, TLS, GitHub App, limits, secrets). It also holds the pure
// helpers that depend only on config: per-app path/branch filtering and
// subdomain/host derivation.
package config

import (
	"fmt"
	"os"
	"path"
	"strings"

	"gopkg.in/yaml.v3"
)

// RepoConfig is the parsed `.prevly.yml` committed at a repo root.
type RepoConfig struct {
	Version  int         `yaml:"version"`
	Triggers Triggers    `yaml:"triggers"`
	Apps     []AppConfig `yaml:"apps"`
	TTL      Duration    `yaml:"ttl"`
	Idle     Duration    `yaml:"idle"`
}

// Triggers decides which PRs get previews.
type Triggers struct {
	// TargetBranches are base branches whose PRs get previews. Empty means all.
	TargetBranches []string `yaml:"target_branches"`
	// ExcludeHeadBranches are globs of head branches to skip (e.g. dependabot/**).
	ExcludeHeadBranches []string `yaml:"exclude_head_branches"`
}

// AppConfig is one buildable+servable unit in a repo.
type AppConfig struct {
	Name        string            `yaml:"name"`
	Paths       []string          `yaml:"paths"`
	Dockerfile  string            `yaml:"dockerfile"`
	Context     string            `yaml:"context"`
	Subdomain   string            `yaml:"subdomain"`
	Port        int               `yaml:"port"`
	BuildArgs   map[string]string `yaml:"build_args"`
	Env         map[string]string `yaml:"env"`
	Secrets     []string          `yaml:"secrets"`
	Healthcheck *Healthcheck      `yaml:"healthcheck"`
}

// Healthcheck describes how to probe readiness on deploy and on wake.
type Healthcheck struct {
	Path    string   `yaml:"path"`
	Timeout Duration `yaml:"timeout"`
}

// MultiApp reports whether the repo declares more than one app (which makes the
// per-app subdomain segment mandatory).
func (c *RepoConfig) MultiApp() bool { return len(c.Apps) > 1 }

// App returns the app with the given name, or false.
func (c *RepoConfig) App(name string) (AppConfig, bool) {
	for _, a := range c.Apps {
		if a.Name == name {
			return a, true
		}
	}
	return AppConfig{}, false
}

// LoadRepoConfig reads and validates a `.prevly.yml` from disk.
func LoadRepoConfig(file string) (*RepoConfig, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return nil, fmt.Errorf("read repo config: %w", err)
	}
	return ParseRepoConfig(data)
}

// ParseRepoConfig parses and validates a `.prevly.yml` from bytes.
func ParseRepoConfig(data []byte) (*RepoConfig, error) {
	var c RepoConfig
	dec := yaml.NewDecoder(strings.NewReader(string(data)))
	dec.KnownFields(true)
	if err := dec.Decode(&c); err != nil {
		return nil, fmt.Errorf("parse repo config: %w", err)
	}
	c.applyDefaults()
	if err := c.Validate(); err != nil {
		return nil, err
	}
	return &c, nil
}

func (c *RepoConfig) applyDefaults() {
	for i := range c.Apps {
		if c.Apps[i].Context == "" {
			c.Apps[i].Context = "."
		}
	}
}

// Validate enforces the schema rules. Errors are meant to be surfaced verbatim
// in the PR (sticky comment + Deployment failure).
func (c *RepoConfig) Validate() error {
	if c.Version != 1 {
		return fmt.Errorf("version: must be 1 (got %d)", c.Version)
	}
	if len(c.Apps) == 0 {
		return fmt.Errorf("apps: at least one app is required")
	}

	seenName := map[string]bool{}
	seenSub := map[string]bool{}
	for i, a := range c.Apps {
		where := fmt.Sprintf("apps[%d]", i)
		if a.Name == "" {
			return fmt.Errorf("%s: name is required", where)
		}
		where = fmt.Sprintf("app %q", a.Name)
		if !validName(a.Name) {
			return fmt.Errorf("%s: name must be lowercase alphanumeric/dash", a.Name)
		}
		if seenName[a.Name] {
			return fmt.Errorf("%s: duplicate app name", a.Name)
		}
		seenName[a.Name] = true

		if len(a.Paths) == 0 {
			return fmt.Errorf("%s: paths is required (at least one glob)", where)
		}
		for _, g := range a.Paths {
			if err := validateGlob(g); err != nil {
				return fmt.Errorf("%s: invalid glob %q: %w", where, g, err)
			}
		}
		if a.Dockerfile == "" {
			return fmt.Errorf("%s: dockerfile is required", where)
		}
		if a.Port <= 0 || a.Port > 65535 {
			return fmt.Errorf("%s: port must be 1-65535 (got %d)", where, a.Port)
		}
		if a.Subdomain != "" {
			if !validName(a.Subdomain) {
				return fmt.Errorf("%s: subdomain %q must be a valid DNS label", where, a.Subdomain)
			}
			if seenSub[a.Subdomain] {
				return fmt.Errorf("%s: duplicate subdomain %q", where, a.Subdomain)
			}
			seenSub[a.Subdomain] = true
		}
	}

	// In a multi-app repo, every app must carry a subdomain to disambiguate.
	if c.MultiApp() {
		for _, a := range c.Apps {
			if a.Subdomain == "" {
				return fmt.Errorf("app %q: subdomain is required in a multi-app repo", a.Name)
			}
		}
	}
	return nil
}

// validateGlob checks a glob expression compiles under path.Match semantics.
// We additionally allow the "**" recursive wildcard, which path.Match rejects;
// it is handled specially by the matcher.
func validateGlob(g string) error {
	if g == "" {
		return fmt.Errorf("empty pattern")
	}
	probe := strings.ReplaceAll(g, "**", "*")
	if _, err := path.Match(probe, "x"); err != nil {
		return err
	}
	return nil
}

func validName(s string) bool {
	if s == "" || len(s) > 63 {
		return false
	}
	for i, r := range s {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '-' && i != 0 && i != len(s)-1:
		default:
			return false
		}
	}
	return true
}
