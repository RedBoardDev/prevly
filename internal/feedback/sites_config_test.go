package feedback

import (
	"strings"
	"testing"

	"github.com/RedBoardDev/prevly/internal/config"
)

func TestResolveSiteKeysAcceptsALongEnoughSecret(t *testing.T) {
	t.Parallel()
	sites := []config.SiteConfig{{Name: "staging", Repo: "acme/shop", KeyEnv: "PREVLY_SITE_STAGING_KEY"}}
	env := map[string]string{"PREVLY_SITE_STAGING_KEY": strings.Repeat("a", 32)}

	keys, err := ResolveSiteKeys(sites, func(name string) string { return env[name] })
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if keys["staging"] != env["PREVLY_SITE_STAGING_KEY"] {
		t.Fatalf("keys = %+v", keys)
	}
}

// TestResolveSiteKeysRejectsMissingOrShortSecret proves a fatal daemon-start
// error names the env var but never the value, for both an unset and a
// too-short secret.
func TestResolveSiteKeysRejectsMissingOrShortSecret(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		env  map[string]string
	}{
		{"missing entirely", map[string]string{}},
		{"too short", map[string]string{"PREVLY_SITE_STAGING_KEY": "short-secret"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			sites := []config.SiteConfig{{Name: "staging", Repo: "acme/shop", KeyEnv: "PREVLY_SITE_STAGING_KEY"}}
			_, err := ResolveSiteKeys(sites, func(name string) string { return tt.env[name] })
			if err == nil {
				t.Fatal("expected an error")
			}
			if !strings.Contains(err.Error(), "PREVLY_SITE_STAGING_KEY") {
				t.Fatalf("error must name the env var: %v", err)
			}
			if v := tt.env["PREVLY_SITE_STAGING_KEY"]; v != "" && strings.Contains(err.Error(), v) {
				t.Fatalf("error must never carry the secret value: %v", err)
			}
		})
	}
}
