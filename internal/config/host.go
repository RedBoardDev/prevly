package config

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// TLS modes supported by the embedded CertMagic-based proxy.
const (
	TLSModeDNS01    = "dns-01"
	TLSModeOnDemand = "on-demand"
)

// HostConfig is the daemon-side configuration (never committed to a repo).
type HostConfig struct {
	BaseDomain string            `yaml:"base_domain"`
	TLS        TLSConfig         `yaml:"tls"`
	GitHub     GitHubConfig      `yaml:"github"`
	Secrets    map[string]string `yaml:"secrets"`
	Limits     Limits            `yaml:"limits"`
	Defaults   Defaults          `yaml:"defaults"`
	DataDir    string            `yaml:"data_dir"`

	// HTTPAddr is the listen address for the HTTP server (webhooks + ACME
	// HTTP-01). Defaults to ":80".
	HTTPAddr string `yaml:"http_addr"`
	// HTTPSAddr is the listen address for the proxy. Defaults to ":443".
	HTTPSAddr string `yaml:"https_addr"`
}

// TLSConfig configures ACME / CertMagic.
type TLSConfig struct {
	Mode     string `yaml:"mode"`     // dns-01 | on-demand
	Provider string `yaml:"provider"` // route53 | cloudflare
	Email    string `yaml:"email"`    // ACME account email
}

// GitHubConfig holds the GitHub App identity and webhook settings. Sensitive
// values (private key, webhook secret) are referenced indirectly: by file path
// or by env-var name, never inline.
type GitHubConfig struct {
	AppID            int64  `yaml:"app_id"`
	PrivateKeyPath   string `yaml:"private_key_path"`
	WebhookSecretEnv string `yaml:"webhook_secret_env"`
}

// Limits caps concurrency and per-preview resources.
type Limits struct {
	MaxConcurrentBuilds   int           `yaml:"max_concurrent_builds"`
	MaxConcurrentPreviews int           `yaml:"max_concurrent_previews"`
	PerPreview            PerPreview    `yaml:"per_preview"`
}

// PerPreview are the resource caps applied to each preview container.
type PerPreview struct {
	CPU    string `yaml:"cpu"`    // docker --cpus
	Memory string `yaml:"memory"` // docker --memory
	PIDs   int64  `yaml:"pids"`   // docker --pids-limit
}

// Defaults provide fallbacks for lifecycle values omitted in `.prevly.yml`.
type Defaults struct {
	TTL  Duration `yaml:"ttl"`
	Idle Duration `yaml:"idle"`
}

// LoadHostConfig reads and validates the host config from disk.
func LoadHostConfig(file string) (*HostConfig, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return nil, fmt.Errorf("read host config: %w", err)
	}
	return ParseHostConfig(data)
}

// ParseHostConfig parses and validates the host config from bytes.
func ParseHostConfig(data []byte) (*HostConfig, error) {
	var c HostConfig
	dec := yaml.NewDecoder(strings.NewReader(string(data)))
	dec.KnownFields(true)
	if err := dec.Decode(&c); err != nil {
		return nil, fmt.Errorf("parse host config: %w", err)
	}
	c.applyDefaults()
	if err := c.Validate(); err != nil {
		return nil, err
	}
	return &c, nil
}

func (c *HostConfig) applyDefaults() {
	if c.HTTPAddr == "" {
		c.HTTPAddr = ":80"
	}
	if c.HTTPSAddr == "" {
		c.HTTPSAddr = ":443"
	}
	if c.DataDir == "" {
		c.DataDir = "/var/lib/prevly"
	}
	if c.TLS.Mode == "" {
		c.TLS.Mode = TLSModeDNS01
	}
	if c.Limits.MaxConcurrentBuilds == 0 {
		c.Limits.MaxConcurrentBuilds = 2
	}
	if c.Limits.MaxConcurrentPreviews == 0 {
		c.Limits.MaxConcurrentPreviews = 30
	}
	if c.Defaults.TTL == 0 {
		c.Defaults.TTL = Duration(30 * day)
	}
	if c.Defaults.Idle == 0 {
		c.Defaults.Idle = Duration(6 * 60 * 60 * 1e9) // 6h
	}
}

// Validate enforces host-config invariants.
func (c *HostConfig) Validate() error {
	if c.BaseDomain == "" {
		return fmt.Errorf("base_domain is required")
	}
	if strings.HasPrefix(c.BaseDomain, ".") || strings.HasPrefix(c.BaseDomain, "*") {
		return fmt.Errorf("base_domain %q must be a bare domain (no leading dot or wildcard)", c.BaseDomain)
	}
	switch c.TLS.Mode {
	case TLSModeDNS01:
		if c.TLS.Provider == "" {
			return fmt.Errorf("tls.provider is required for dns-01 mode")
		}
		switch c.TLS.Provider {
		case "route53", "cloudflare":
		default:
			return fmt.Errorf("tls.provider %q unsupported (route53|cloudflare)", c.TLS.Provider)
		}
	case TLSModeOnDemand:
	default:
		return fmt.Errorf("tls.mode %q unsupported (dns-01|on-demand)", c.TLS.Mode)
	}
	if c.TLS.Email == "" {
		return fmt.Errorf("tls.email (ACME account email) is required")
	}
	if c.GitHub.AppID == 0 {
		return fmt.Errorf("github.app_id is required")
	}
	if c.GitHub.PrivateKeyPath == "" {
		return fmt.Errorf("github.private_key_path is required")
	}
	if c.GitHub.WebhookSecretEnv == "" {
		return fmt.Errorf("github.webhook_secret_env is required")
	}
	return nil
}
