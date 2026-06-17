package config

import (
	"reflect"
	"testing"
)

func multiAppConfig() *RepoConfig {
	return &RepoConfig{
		Version: 1,
		Apps: []AppConfig{
			{Name: "backoffice", Subdomain: "bo", Port: 3000, Dockerfile: "apps/bo/Dockerfile",
				Paths: []string{"apps/backoffice/**", "packages/ui/**", "yarn.lock"}},
			{Name: "audit", Subdomain: "audit", Port: 3000, Dockerfile: "apps/audit/Dockerfile",
				Paths: []string{"apps/audit/**", "packages/sdk/**", "yarn.lock"}},
		},
	}
}

func TestMatchGlob(t *testing.T) {
	t.Parallel()
	tests := []struct {
		pattern string
		name    string
		want    bool
	}{
		{"apps/backoffice/**", "apps/backoffice/page.tsx", true},
		{"apps/backoffice/**", "apps/backoffice/a/b/c.ts", true},
		{"apps/backoffice/**", "apps/audit/page.tsx", false},
		{"**", "anything/at/all", true},
		{"yarn.lock", "yarn.lock", true},
		{"yarn.lock", "apps/yarn.lock", false},
		{"packages/*/index.ts", "packages/ui/index.ts", true},
		{"packages/*/index.ts", "packages/ui/sub/index.ts", false},
		{"**/Dockerfile", "apps/bo/Dockerfile", true},
		{"apps/**/test.ts", "apps/a/b/test.ts", true},
		{"apps/**/test.ts", "apps/test.ts", true},
		{"apps/**/test.ts", "apps/a/b/other.ts", false},
	}
	for _, tt := range tests {
		t.Run(tt.pattern+"~"+tt.name, func(t *testing.T) {
			t.Parallel()
			if got := matchGlob(tt.pattern, tt.name); got != tt.want {
				t.Fatalf("matchGlob(%q,%q) = %v, want %v", tt.pattern, tt.name, got, tt.want)
			}
		})
	}
}

func TestMatchedApps(t *testing.T) {
	t.Parallel()
	cfg := multiAppConfig()

	tests := []struct {
		name    string
		changed []string
		want    []string
	}{
		{"only backoffice", []string{"apps/backoffice/page.tsx"}, []string{"backoffice"}},
		{"only audit", []string{"apps/audit/x.ts"}, []string{"audit"}},
		{"shared lockfile hits both", []string{"yarn.lock"}, []string{"backoffice", "audit"}},
		{"shared sdk hits audit only", []string{"packages/sdk/client.ts"}, []string{"audit"}},
		{"unrelated file hits none", []string{"README.md"}, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := names(cfg.MatchedApps(tt.changed))
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("MatchedApps(%v) = %v, want %v", tt.changed, got, tt.want)
			}
		})
	}
}

func names(apps []AppConfig) []string {
	if len(apps) == 0 {
		return nil
	}
	out := make([]string, len(apps))
	for i, a := range apps {
		out[i] = a.Name
	}
	return out
}

func TestBranchAllowed(t *testing.T) {
	t.Parallel()
	cfg := &RepoConfig{
		Triggers: Triggers{
			TargetBranches:      []string{"main", "release"},
			ExcludeHeadBranches: []string{"dependabot/**", "renovate/*"},
		},
	}
	tests := []struct {
		name       string
		base, head string
		want       bool
	}{
		{"main base ok", "main", "feature/x", true},
		{"release base ok", "release", "fix/y", true},
		{"develop base rejected", "develop", "feature/x", false},
		{"dependabot head excluded", "main", "dependabot/npm/lodash", false},
		{"renovate head excluded", "main", "renovate/react", false},
		{"normal head ok", "main", "feature/login", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := cfg.BranchAllowed(tt.base, tt.head); got != tt.want {
				t.Fatalf("BranchAllowed(%q,%q) = %v, want %v", tt.base, tt.head, got, tt.want)
			}
		})
	}
}

func TestBranchAllowedEmptyTriggersAllowsAll(t *testing.T) {
	t.Parallel()
	cfg := &RepoConfig{}
	if !cfg.BranchAllowed("anything", "any-head") {
		t.Fatal("empty triggers should allow any branch")
	}
}

func TestHostDerivation(t *testing.T) {
	t.Parallel()
	base := "preview.staging.kare-app.fr"

	multi := multiAppConfig()
	bo, _ := multi.App("backoffice")
	if got := multi.Host(base, 42, bo); got != "pr-42-bo.preview.staging.kare-app.fr" {
		t.Fatalf("multi-app host = %q", got)
	}

	single := &RepoConfig{Version: 1, Apps: []AppConfig{
		{Name: "web", Port: 3000, Dockerfile: "Dockerfile", Paths: []string{"**"}},
	}}
	web, _ := single.App("web")
	if got := single.Host(base, 7, web); got != "pr-7.preview.staging.kare-app.fr" {
		t.Fatalf("single-app host = %q", got)
	}
}
