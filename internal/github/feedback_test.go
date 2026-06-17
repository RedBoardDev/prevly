package github

import (
	"strings"
	"testing"

	"github.com/RedBoardDev/prevly/internal/model"
)

func TestRenderStickyComment(t *testing.T) {
	t.Parallel()
	body := RenderStickyComment([]AppStatus{
		{App: "bo", Status: model.StatusRunning, URL: "https://pr-42-bo.example.com"},
		{App: "audit", Status: model.StatusFailed, LogExcerpt: "npm ERR! boom"},
	})

	if !strings.HasPrefix(body, stickyMarker) {
		t.Fatal("comment must start with the sticky marker for find-or-update")
	}
	if !strings.Contains(body, "https://pr-42-bo.example.com") {
		t.Fatal("live app URL missing")
	}
	if !strings.Contains(body, "npm ERR! boom") {
		t.Fatal("failure log excerpt should be surfaced")
	}
	if !strings.Contains(body, "live") || !strings.Contains(body, "failed") {
		t.Fatal("status badges missing")
	}
}

func TestDeploymentState(t *testing.T) {
	t.Parallel()
	tests := []struct {
		status model.Status
		want   string
	}{
		{model.StatusBuilding, "in_progress"},
		{model.StatusRunning, "success"},
		{model.StatusSleeping, "success"},
		{model.StatusFailed, "failure"},
		{model.StatusDestroyed, "inactive"},
	}
	for _, tt := range tests {
		if got := deploymentState(tt.status); got != tt.want {
			t.Errorf("deploymentState(%q) = %q, want %q", tt.status, got, tt.want)
		}
	}
}
