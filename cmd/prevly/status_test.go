package main

import (
	"strings"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/model"
)

func TestRenderStatusSortsAndFormats(t *testing.T) {
	t.Parallel()
	now := time.Now()
	previews := []*model.Preview{
		{Repo: "org/b", PRNumber: 2, AppName: "web", Status: model.StatusSleeping, URL: "https://b", CreatedAt: now.Add(-3 * time.Hour), LastSeenAt: now.Add(-90 * time.Minute)},
		{Repo: "org/a", PRNumber: 1, AppName: "bo", Status: model.StatusRunning, URL: "https://a", CreatedAt: now.Add(-30 * time.Second), LastSeenAt: now.Add(-10 * time.Second)},
	}

	var buf strings.Builder
	if err := renderStatus(&buf, previews, now); err != nil {
		t.Fatalf("renderStatus: %v", err)
	}
	out := buf.String()

	if !strings.Contains(out, "REPO") || !strings.Contains(out, "LAST SEEN") {
		t.Fatalf("missing header:\n%s", out)
	}
	// Sorted by Key(): org/a#1#bo must appear before org/b#2#web.
	a := strings.Index(out, "org/a")
	b := strings.Index(out, "org/b")
	if a == -1 || b == -1 || a > b {
		t.Fatalf("rows not sorted by key:\n%s", out)
	}
	// Age formatting: the running preview is ~30s old.
	if !strings.Contains(out, "30s") {
		t.Fatalf("expected 30s age in output:\n%s", out)
	}
}

func TestRenderStatusEmpty(t *testing.T) {
	t.Parallel()
	var buf strings.Builder
	if err := renderStatus(&buf, nil, time.Now()); err != nil {
		t.Fatalf("renderStatus empty: %v", err)
	}
	if !strings.Contains(buf.String(), "REPO") {
		t.Fatalf("expected header even when empty:\n%s", buf.String())
	}
}
