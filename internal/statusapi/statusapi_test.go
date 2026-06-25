package statusapi

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/model"
)

type fakeLister struct {
	previews []*model.Preview
	err      error
}

func (f fakeLister) List() ([]*model.Preview, error) { return f.previews, f.err }

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// waitForSocket blocks until Serve has created the socket (Serve runs async).
func waitForSocket(t *testing.T, ctx context.Context, dataDir string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		if _, err := Query(ctx, dataDir); !errors.Is(err, ErrDaemonNotRunning) {
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("status socket never came up")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestServeAndQueryRoundTrip(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	want := []*model.Preview{
		{Repo: "org/a", PRNumber: 1, AppName: "bo", Host: "pr-1-bo.x", Status: model.StatusRunning},
		{Repo: "org/b", PRNumber: 2, AppName: "web", Host: "pr-2.y", Status: model.StatusSleeping},
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- Serve(ctx, dataDir, fakeLister{previews: want}, testLogger()) }()

	waitForSocket(t, ctx, dataDir)

	got, err := Query(ctx, dataDir)
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if len(got) != len(want) {
		t.Fatalf("got %d previews, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i].Host != want[i].Host || got[i].Status != want[i].Status {
			t.Fatalf("preview %d mismatch: got %+v want %+v", i, got[i], want[i])
		}
	}

	// Shutdown removes the socket and Query falls back to "not running".
	cancel()
	if err := <-done; err != nil {
		t.Fatalf("serve returned error: %v", err)
	}
	if _, err := Query(context.Background(), dataDir); !errors.Is(err, ErrDaemonNotRunning) {
		t.Fatalf("after shutdown, want ErrDaemonNotRunning, got %v", err)
	}
}

func TestQueryDaemonNotRunning(t *testing.T) {
	t.Parallel()
	// No Serve: socket file is absent.
	_, err := Query(context.Background(), t.TempDir())
	if !errors.Is(err, ErrDaemonNotRunning) {
		t.Fatalf("want ErrDaemonNotRunning, got %v", err)
	}
}

func TestServeRemovesStaleSocket(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	// Simulate a stale socket left by a crashed daemon.
	stale := SocketPath(dataDir)
	if err := os.WriteFile(stale, []byte("stale"), 0o600); err != nil {
		t.Fatalf("seed stale socket: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- Serve(ctx, dataDir, fakeLister{}, testLogger()) }()

	waitForSocket(t, ctx, dataDir)
	cancel()
	if err := <-done; err != nil {
		t.Fatalf("serve returned error after stale socket: %v", err)
	}
}

func TestSocketPath(t *testing.T) {
	t.Parallel()
	if got, want := SocketPath("/var/lib/prevly"), filepath.Join("/var/lib/prevly", SocketName); got != want {
		t.Fatalf("SocketPath = %q, want %q", got, want)
	}
}
