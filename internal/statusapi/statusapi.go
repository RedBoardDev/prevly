// Package statusapi exposes the daemon's preview state over a Unix-domain
// socket so CLI commands (e.g. `prevly status`) can read it without opening the
// bbolt store directly.
//
// The store takes an exclusive file lock while the daemon is running, so any
// second process that opens it blocks and fails with "open store: timeout".
// Rather than fight that lock, the daemon serves a small read-only HTTP API on
// a Unix socket under the data dir; the CLI queries it and only falls back to a
// direct read-only store open when the daemon is down.
package statusapi

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	applog "github.com/RedBoardDev/prevly/internal/log"
	"github.com/RedBoardDev/prevly/internal/model"
)

// SocketName is the Unix socket file name under the data dir.
const SocketName = "prevly.sock"

// statusPath is the single HTTP route served on the socket.
const statusPath = "/status"

// SocketPath returns the status socket path for a given data dir.
func SocketPath(dataDir string) string {
	return filepath.Join(dataDir, SocketName)
}

// Lister is the read-only view of the store the API needs.
type Lister interface {
	List() ([]*model.Preview, error)
}

// Serve runs the status API on a Unix socket under dataDir until ctx is
// cancelled. The socket is created with 0600 perms and removed on shutdown.
// A pre-existing stale socket (e.g. after a crash) is removed first.
func Serve(ctx context.Context, dataDir string, store Lister, logger *applog.Logger) error {
	path := SocketPath(dataDir)
	// Remove a stale socket left by a previous run; otherwise Listen fails with
	// "address already in use".
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}

	ln, err := net.Listen("unix", path)
	if err != nil {
		return err
	}
	// Tighten perms: only the daemon's user may talk to the socket.
	if err := os.Chmod(path, 0o600); err != nil {
		_ = ln.Close()
		return err
	}

	mux := http.NewServeMux()
	mux.HandleFunc(statusPath, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		previews, err := store.List()
		if err != nil {
			logger.Error("status api: list previews", "err", err)
			http.Error(w, "list previews", http.StatusInternalServerError)
			return
		}
		if previews == nil {
			previews = []*model.Preview{}
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(previews); err != nil {
			logger.Error("status api: encode previews", "err", err)
		}
	})

	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}

	errCh := make(chan error, 1)
	go func() { errCh <- serve(srv, ln) }()

	logger.Info("status api listening", "socket", path)

	select {
	case <-ctx.Done():
		shutdown(srv)
		_ = os.Remove(path)
		return nil
	case err := <-errCh:
		_ = os.Remove(path)
		return err
	}
}

func serve(srv *http.Server, ln net.Listener) error {
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func shutdown(srv *http.Server) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

// Query connects to the daemon's status socket under dataDir and returns the
// current previews. ErrDaemonNotRunning is returned (wrapped) when the socket
// is absent or refuses the connection, so callers can fall back to a direct
// store read.
func Query(ctx context.Context, dataDir string) ([]*model.Preview, error) {
	path := SocketPath(dataDir)
	client := &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				var d net.Dialer
				return d.DialContext(ctx, "unix", path)
			},
		},
		Timeout: 5 * time.Second,
	}

	// The host is ignored (the dialer is hard-wired to the socket) but must be
	// a valid URL.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://unix"+statusPath, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		if isDaemonDown(err) {
			return nil, ErrDaemonNotRunning
		}
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, errStatus(resp.StatusCode)
	}
	var previews []*model.Preview
	if err := json.NewDecoder(resp.Body).Decode(&previews); err != nil {
		return nil, err
	}
	return previews, nil
}
