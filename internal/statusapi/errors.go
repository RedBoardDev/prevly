package statusapi

import (
	"errors"
	"fmt"
	"net"
	"os"
	"syscall"
)

// ErrDaemonNotRunning means the status socket is absent or refusing
// connections, i.e. the daemon is not running. Callers should fall back to a
// direct (read-only) store read.
var ErrDaemonNotRunning = errors.New("prevly daemon not running")

// errStatus reports a non-200 response from the status API.
func errStatus(code int) error {
	return fmt.Errorf("status api returned HTTP %d", code)
}

// isDaemonDown reports whether a request error means the daemon is not running.
// Any failure while *dialing* the socket (missing file, nothing listening, or an
// unusable socket path) counts: the daemon is unreachable, so the caller should
// fall back to a direct store read. Errors after a connection is established
// (HTTP-level failures) do not — those are surfaced to the user.
func isDaemonDown(err error) bool {
	if errors.Is(err, os.ErrNotExist) ||
		errors.Is(err, syscall.ENOENT) ||
		errors.Is(err, syscall.ECONNREFUSED) {
		return true
	}
	var opErr *net.OpError
	if errors.As(err, &opErr) && opErr.Op == "dial" {
		return true
	}
	return false
}
