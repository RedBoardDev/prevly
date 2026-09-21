package config

import (
	"strings"
	"testing"
	"time"
)

const minimalHostYAML = "base_domain: x.com\ntls: {mode: on-demand, email: a@b.c}\n"

func TestHostFeedbackDefaults(t *testing.T) {
	t.Parallel()
	cfg, err := ParseHostConfig([]byte(minimalHostYAML))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !cfg.Feedback.On() {
		t.Fatal("feedback must default to enabled")
	}
	if cfg.Feedback.Retention.Std() != 90*24*time.Hour {
		t.Fatalf("retention = %v", cfg.Feedback.Retention.Std())
	}
	if cfg.Feedback.MaxPerHour != 30 {
		t.Fatalf("max_per_hour = %d", cfg.Feedback.MaxPerHour)
	}
}

func TestHostFeedbackExplicit(t *testing.T) {
	t.Parallel()
	yaml := minimalHostYAML + "feedback:\n  enabled: false\n  retention: 7d\n  max_per_hour: 5\n"
	cfg, err := ParseHostConfig([]byte(yaml))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Feedback.On() {
		t.Fatal("explicit enabled:false must survive defaulting")
	}
	if cfg.Feedback.Retention.Std() != 7*24*time.Hour {
		t.Fatalf("retention = %v", cfg.Feedback.Retention.Std())
	}
	if cfg.Feedback.MaxPerHour != 5 {
		t.Fatalf("max_per_hour = %d", cfg.Feedback.MaxPerHour)
	}
}

func TestHostFeedbackValidationErrors(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		yaml string
		msg  string
	}{
		{"negative retention", minimalHostYAML + "feedback: {retention: -1h}\n", "feedback.retention"},
		{"negative rate", minimalHostYAML + "feedback: {max_per_hour: -1}\n", "feedback.max_per_hour"},
		{"unknown key", minimalHostYAML + "feedback: {nope: 1}\n", "field nope"},
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

func TestRepoFeedbackOptOut(t *testing.T) {
	t.Parallel()
	base := "version: 1\napps:\n  - {name: web, paths: [\"**\"], dockerfile: Dockerfile, port: 3000}\n"

	cfg, err := ParseRepoConfig([]byte(base))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !cfg.FeedbackOn() {
		t.Fatal("repo feedback must default to enabled")
	}

	cfg, err = ParseRepoConfig([]byte(base + "feedback: false\n"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.FeedbackOn() {
		t.Fatal("feedback: false must opt the repo out")
	}

	var nilCfg *RepoConfig
	if !nilCfg.FeedbackOn() {
		t.Fatal("a nil repo config must read as opted in")
	}
}
