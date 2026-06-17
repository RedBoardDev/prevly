package github

import (
	"reflect"
	"testing"

	"github.com/RedBoardDev/prevly/internal/config"
)

func TestParseCommand(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		body string
		want Command
		ok   bool
	}{
		{"status", "/preview status", Command{Action: "status"}, true},
		{"redeploy all", "/preview redeploy", Command{Action: "redeploy"}, true},
		{"destroy app", "/preview destroy audit", Command{Action: "destroy", App: "audit"}, true},
		{"embedded in text", "please run\n/preview redeploy bo\nthanks", Command{Action: "redeploy", App: "bo"}, true},
		{"leading spaces", "   /preview status  ", Command{Action: "status"}, true},
		{"unknown action", "/preview frobnicate", Command{}, false},
		{"not a command", "looks good to me", Command{}, false},
		{"bare slash", "/preview", Command{}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, ok := ParseCommand(tt.body)
			if ok != tt.ok {
				t.Fatalf("ok = %v, want %v", ok, tt.ok)
			}
			if ok && got != tt.want {
				t.Fatalf("ParseCommand = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestAutoBuildAllowed(t *testing.T) {
	t.Parallel()
	tests := []struct {
		fromFork bool
		assoc    string
		want     bool
	}{
		{false, "NONE", true},        // same-repo PR always builds
		{false, "FIRST_TIMER", true}, // same-repo, untrusted association still ok
		{true, "OWNER", true},        // fork PR by maintainer
		{true, "MEMBER", true},
		{true, "COLLABORATOR", true},
		{true, "CONTRIBUTOR", false}, // untrusted fork is gated
		{true, "NONE", false},
	}
	for _, tt := range tests {
		t.Run(tt.assoc, func(t *testing.T) {
			t.Parallel()
			if got := AutoBuildAllowed(tt.fromFork, tt.assoc); got != tt.want {
				t.Fatalf("AutoBuildAllowed(%v,%q) = %v, want %v", tt.fromFork, tt.assoc, got, tt.want)
			}
		})
	}
}

func TestAppsToDeploy(t *testing.T) {
	t.Parallel()
	cfg := &config.RepoConfig{
		Version:  1,
		Triggers: config.Triggers{TargetBranches: []string{"main"}, ExcludeHeadBranches: []string{"dependabot/**"}},
		Apps: []config.AppConfig{
			{Name: "bo", Subdomain: "bo", Port: 3000, Dockerfile: "D", Paths: []string{"apps/bo/**"}},
			{Name: "audit", Subdomain: "audit", Port: 3000, Dockerfile: "D", Paths: []string{"apps/audit/**"}},
		},
	}

	// Wrong base branch -> nothing.
	if got := AppsToDeploy(cfg, "develop", "feature", []string{"apps/bo/x"}); got != nil {
		t.Fatalf("non-target base should deploy nothing, got %v", got)
	}
	// Excluded head branch -> nothing.
	if got := AppsToDeploy(cfg, "main", "dependabot/npm/x", []string{"apps/bo/x"}); got != nil {
		t.Fatalf("excluded head should deploy nothing, got %v", got)
	}
	// Path filter -> only bo.
	got := AppsToDeploy(cfg, "main", "feature/login", []string{"apps/bo/page.tsx"})
	if !reflect.DeepEqual(appNames(got), []string{"bo"}) {
		t.Fatalf("want [bo], got %v", appNames(got))
	}
}

func appNames(apps []config.AppConfig) []string {
	if len(apps) == 0 {
		return nil
	}
	out := make([]string, len(apps))
	for i, a := range apps {
		out[i] = a.Name
	}
	return out
}
