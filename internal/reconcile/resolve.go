package reconcile

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/RedBoardDev/prevly/internal/config"
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
// If the container was removed out from under us (external prune), it recreates
// it from the existing image — no rebuild.
func (r *Reconciler) wake(ctx context.Context, p *model.Preview) error {
	r.logger.Info("waking preview", "host", p.Host)
	if err := r.runtime.Start(ctx, p.ContainerID); err != nil {
		if !isContainerGone(err) {
			return fmt.Errorf("wake start: %w", err)
		}
		r.logger.Warn("container missing on wake; recreating from image", "host", p.Host)
		if rerr := r.recreateFromImage(ctx, p); rerr != nil {
			return fmt.Errorf("wake recreate: %w", rerr)
		}
	}
	// TCP accepts as soon as docker's port proxy binds — before the app listens —
	// so probe HTTP: only route once the app actually responds, else the first
	// request after a wake hits an empty upstream and gets a 502.
	if err := waitHTTP(ctx, p.Port, "/", r.readyTimeout); err != nil {
		return fmt.Errorf("wake readiness: %w", err)
	}
	p.Status = model.StatusRunning
	p.LastSeenAt = r.now()
	if err := r.store.Put(p); err != nil {
		return err
	}
	go r.publishPreviewAsync(p) // reflect 🟢 live again, off the request path
	return nil
}

// publishPreviewAsync publishes PR feedback off the request path: the request
// context is canceled once the response is sent, so use a fresh bounded one.
func (r *Reconciler) publishPreviewAsync(p *model.Preview) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	r.publishPreview(ctx, p)
}

func upstream(p *model.Preview) string {
	return fmt.Sprintf("127.0.0.1:%d", p.Port)
}

// isContainerGone reports whether a docker error means the container no longer
// exists (so it can be recreated rather than treated as a hard failure).
func isContainerGone(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "no such container")
}

// awaitReady blocks until the freshly-started container accepts connections and,
// if a healthcheck path is configured, returns a non-5xx response.
func (r *Reconciler) awaitReady(ctx context.Context, p *model.Preview, app config.AppConfig) error {
	timeout := r.readyTimeout
	if app.Healthcheck != nil && app.Healthcheck.Timeout > 0 {
		timeout = app.Healthcheck.Timeout.Std()
	}
	if err := waitReady(ctx, p.Port, timeout); err != nil {
		return err
	}
	// Default to probing "/" when no healthcheck is configured: a TCP accept
	// alone is fooled by docker's port proxy, so wait until the app serves HTTP.
	path := "/"
	if app.Healthcheck != nil && app.Healthcheck.Path != "" {
		path = app.Healthcheck.Path
	}
	return waitHTTP(ctx, p.Port, path, timeout)
}

// waitHTTP polls an HTTP path until it returns a non-5xx status or times out.
func waitHTTP(ctx context.Context, port int, path string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	url := fmt.Sprintf("http://127.0.0.1:%d%s", port, path)
	client := &http.Client{Timeout: 3 * time.Second}
	for {
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		resp, err := client.Do(req)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode < 500 {
				return nil
			}
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("healthcheck %s not healthy within %s", path, timeout)
		}
		time.Sleep(200 * time.Millisecond)
	}
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
