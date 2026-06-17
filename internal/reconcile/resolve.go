package reconcile

import (
	"context"
	"errors"
	"fmt"
	"net"
	"time"

	"github.com/RedBoardDev/prevly/internal/ingress"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/store"
)

// Resolve maps a request host to its upstream, waking a sleeping preview on
// demand. It implements ingress.Resolver.
func (r *Reconciler) Resolve(ctx context.Context, host string) (ingress.Target, bool, error) {
	p, err := r.store.ListByHost(host)
	if errors.Is(err, store.ErrNotFound) {
		return ingress.Target{}, false, nil
	}
	if err != nil {
		return ingress.Target{}, false, err
	}

	switch p.Status {
	case model.StatusRunning:
		r.touch(p)
		return ingress.Target{Upstream: upstream(p)}, true, nil
	case model.StatusSleeping:
		if err := r.wake(ctx, p); err != nil {
			return ingress.Target{}, false, err
		}
		return ingress.Target{Upstream: upstream(p)}, true, nil
	default:
		return ingress.Target{}, false, nil
	}
}

// Known reports whether host maps to a preview, gating on-demand TLS.
func (r *Reconciler) Known(host string) bool {
	_, err := r.store.ListByHost(host)
	return err == nil
}

func (r *Reconciler) touch(p *model.Preview) {
	p.LastSeenAt = r.now()
	if err := r.store.Put(p); err != nil {
		r.logger.Warn("touch preview", "host", p.Host, "err", err)
	}
}

// wake starts a sleeping container, waits for readiness and marks it running.
func (r *Reconciler) wake(ctx context.Context, p *model.Preview) error {
	r.logger.Info("waking preview", "host", p.Host)
	if err := r.runtime.Start(ctx, p.ContainerID); err != nil {
		return fmt.Errorf("wake start: %w", err)
	}
	if err := waitReady(ctx, p.Port, 10*time.Second); err != nil {
		return fmt.Errorf("wake readiness: %w", err)
	}
	p.Status = model.StatusRunning
	p.LastSeenAt = r.now()
	return r.store.Put(p)
}

func upstream(p *model.Preview) string {
	return fmt.Sprintf("127.0.0.1:%d", p.Port)
}

// waitReady polls the upstream TCP port until it accepts a connection.
func waitReady(ctx context.Context, port int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		conn, err := net.DialTimeout("tcp", addr, time.Second)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("timed out waiting for %s", addr)
		}
		time.Sleep(100 * time.Millisecond)
	}
}
