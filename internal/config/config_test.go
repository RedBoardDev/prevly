package config

import (
	"strings"
	"testing"
	"time"
)

const validRepoYAML = `
version: 1
triggers:
  target_branches: [main]
  exclude_head_branches: ["dependabot/**"]
apps:
  - name: backoffice
    paths: ["apps/backoffice/**", "yarn.lock"]
    dockerfile: apps/backoffice/Dockerfile
    subdomain: bo
    port: 3000
    build_args:
      NEXT_PUBLIC_API_URL: https://api.example.com
    secrets: [SA_KEY]
  - name: audit
    paths: ["apps/audit/**"]
    dockerfile: apps/audit/Dockerfile
    subdomain: audit
    port: 3000
ttl: 30d
idle: 6h
`

func TestParseRepoConfigValid(t *testing.T) {
	t.Parallel()
	cfg, err := ParseRepoConfig([]byte(validRepoYAML))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Apps) != 2 {
		t.Fatalf("want 2 apps, got %d", len(cfg.Apps))
	}
	if cfg.TTL.Std() != 30*24*time.Hour {
		t.Fatalf("ttl = %v", cfg.TTL.Std())
	}
	if cfg.Idle.Std() != 6*time.Hour {
		t.Fatalf("idle = %v", cfg.Idle.Std())
	}
	if cfg.Apps[0].Context != "." {
		t.Fatalf("default context not applied: %q", cfg.Apps[0].Context)
	}
}

func TestRepoConfigValidationErrors(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		yaml string
		msg  string
	}{
		{
			name: "wrong version",
			yaml: "version: 2\napps:\n  - name: a\n    paths: [\"**\"]\n    dockerfile: D\n    port: 80\n",
			msg:  "version",
		},
		{
			name: "no apps",
			yaml: "version: 1\napps: []\n",
			msg:  "at least one app",
		},
		{
			name: "duplicate app name",
			yaml: "version: 1\napps:\n  - {name: a, paths: [\"**\"], dockerfile: D, port: 80, subdomain: x}\n  - {name: a, paths: [\"**\"], dockerfile: D, port: 81, subdomain: y}\n",
			msg:  "duplicate app name",
		},
		{
			name: "duplicate subdomain",
			yaml: "version: 1\napps:\n  - {name: a, paths: [\"**\"], dockerfile: D, port: 80, subdomain: x}\n  - {name: b, paths: [\"**\"], dockerfile: D, port: 81, subdomain: x}\n",
			msg:  "duplicate subdomain",
		},
		{
			name: "missing subdomain in multi-app",
			yaml: "version: 1\napps:\n  - {name: a, paths: [\"**\"], dockerfile: D, port: 80, subdomain: x}\n  - {name: b, paths: [\"**\"], dockerfile: D, port: 81}\n",
			msg:  "subdomain is required in a multi-app repo",
		},
		{
			name: "missing dockerfile",
			yaml: "version: 1\napps:\n  - {name: a, paths: [\"**\"], port: 80}\n",
			msg:  "dockerfile is required",
		},
		{
			name: "missing paths",
			yaml: "version: 1\napps:\n  - {name: a, dockerfile: D, port: 80}\n",
			msg:  "paths is required",
		},
		{
			name: "bad port",
			yaml: "version: 1\napps:\n  - {name: a, paths: [\"**\"], dockerfile: D, port: 0}\n",
			msg:  "port must be",
		},
		{
			name: "unknown field rejected",
			yaml: "version: 1\nbogus: true\napps:\n  - {name: a, paths: [\"**\"], dockerfile: D, port: 80}\n",
			msg:  "field bogus not found",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := ParseRepoConfig([]byte(tt.yaml))
			if err == nil {
				t.Fatalf("expected error containing %q", tt.msg)
			}
			if !strings.Contains(err.Error(), tt.msg) {
				t.Fatalf("error %q does not contain %q", err.Error(), tt.msg)
			}
		})
	}
}

func TestSingleAppNoSubdomainAllowed(t *testing.T) {
	t.Parallel()
	yaml := "version: 1\napps:\n  - {name: web, paths: [\"**\"], dockerfile: Dockerfile, port: 3000}\n"
	if _, err := ParseRepoConfig([]byte(yaml)); err != nil {
		t.Fatalf("single-app without subdomain should be valid: %v", err)
	}
}

const validHostYAML = `
base_domain: preview.staging.kare-app.fr
tls:
  mode: dns-01
  provider: route53
  email: ops@example.com
github:
  app_id: 123456
  private_key_path: /etc/prevly/github-app.pem
  webhook_secret_env: PREVLY_WEBHOOK_SECRET
secrets:
  SA_KEY: env:PREVLY_SECRET_SA_KEY
limits:
  max_concurrent_builds: 2
  max_concurrent_previews: 30
  per_preview:
    cpu: "1.5"
    memory: "512m"
    pids: 512
defaults:
  ttl: 30d
  idle: 6h
data_dir: /var/lib/prevly
`

func TestParseHostConfigValid(t *testing.T) {
	t.Parallel()
	cfg, err := ParseHostConfig([]byte(validHostYAML))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.BaseDomain != "preview.staging.kare-app.fr" {
		t.Fatalf("base_domain = %q", cfg.BaseDomain)
	}
	if cfg.HTTPSAddr != ":443" {
		t.Fatalf("default https addr = %q", cfg.HTTPSAddr)
	}
}

func TestHostConfigValidationErrors(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		yaml string
		msg  string
	}{
		{"no base_domain", "tls:\n  mode: on-demand\n  email: a@b.c\ngithub:\n  app_id: 1\n  private_key_path: k\n  webhook_secret_env: W\n", "base_domain is required"},
		{"wildcard base_domain", "base_domain: \"*.x.com\"\ntls: {mode: on-demand, email: a@b.c}\ngithub: {app_id: 1, private_key_path: k, webhook_secret_env: W}\n", "bare domain"},
		{"bad tls mode", "base_domain: x.com\ntls: {mode: bogus, email: a@b.c}\ngithub: {app_id: 1, private_key_path: k, webhook_secret_env: W}\n", "tls.mode"},
		{"dns01 needs provider", "base_domain: x.com\ntls: {mode: dns-01, email: a@b.c}\ngithub: {app_id: 1, private_key_path: k, webhook_secret_env: W}\n", "tls.provider is required"},
		{"missing app_id", "base_domain: x.com\ntls: {mode: on-demand, email: a@b.c}\ngithub: {private_key_path: k, webhook_secret_env: W}\n", "github.app_id"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := ParseHostConfig([]byte(tt.yaml))
			if err == nil {
				t.Fatalf("expected error containing %q", tt.msg)
			}
			if !strings.Contains(err.Error(), tt.msg) {
				t.Fatalf("error %q does not contain %q", err.Error(), tt.msg)
			}
		})
	}
}
