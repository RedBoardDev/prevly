package store

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/model"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	st, err := Open(filepath.Join(t.TempDir(), "state.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}

func TestPutGetDelete(t *testing.T) {
	t.Parallel()
	st := newTestStore(t)
	p := &model.Preview{Repo: "org/repo", PRNumber: 1, AppName: "bo", Status: model.StatusRunning, Host: "pr-1-bo.x.com", CreatedAt: time.Now()}

	if err := st.Put(p); err != nil {
		t.Fatalf("put: %v", err)
	}
	got, err := st.Get("org/repo", 1, "bo")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Host != p.Host || got.Status != model.StatusRunning {
		t.Fatalf("round-trip mismatch: %+v", got)
	}

	if err := st.Delete("org/repo", 1, "bo"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := st.Get("org/repo", 1, "bo"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestListByPRAndHost(t *testing.T) {
	t.Parallel()
	st := newTestStore(t)
	previews := []*model.Preview{
		{Repo: "org/a", PRNumber: 1, AppName: "bo", Host: "pr-1-bo.x"},
		{Repo: "org/a", PRNumber: 1, AppName: "audit", Host: "pr-1-audit.x"},
		{Repo: "org/a", PRNumber: 2, AppName: "bo", Host: "pr-2-bo.x"},
		{Repo: "org/b", PRNumber: 1, AppName: "web", Host: "pr-1.y"},
	}
	for _, p := range previews {
		if err := st.Put(p); err != nil {
			t.Fatalf("put: %v", err)
		}
	}

	pr1, err := st.ListByPR("org/a", 1)
	if err != nil {
		t.Fatalf("list by pr: %v", err)
	}
	if len(pr1) != 2 {
		t.Fatalf("want 2 previews for org/a#1, got %d", len(pr1))
	}

	byHost, err := st.ListByHost("pr-2-bo.x")
	if err != nil {
		t.Fatalf("list by host: %v", err)
	}
	if byHost.AppName != "bo" || byHost.PRNumber != 2 {
		t.Fatalf("unexpected preview by host: %+v", byHost)
	}

	if _, err := st.ListByHost("does-not-exist"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound for unknown host, got %v", err)
	}
}

func TestOpenReadOnly(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "state.db")

	// Seed the DB with a writer, then release the exclusive lock.
	st, err := Open(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	p := &model.Preview{Repo: "org/repo", PRNumber: 7, AppName: "bo", Status: model.StatusRunning, Host: "pr-7-bo.x"}
	if err := st.Put(p); err != nil {
		t.Fatalf("put: %v", err)
	}
	if err := st.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	// A read-only open (shared lock) must see the data — this backs the CLI
	// fallback used when the daemon is down.
	ro, err := OpenReadOnly(path)
	if err != nil {
		t.Fatalf("open read-only: %v", err)
	}
	defer ro.Close()

	previews, err := ro.List()
	if err != nil {
		t.Fatalf("list read-only: %v", err)
	}
	if len(previews) != 1 || previews[0].Host != "pr-7-bo.x" {
		t.Fatalf("unexpected read-only list: %+v", previews)
	}
}
