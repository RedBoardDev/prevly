package reconcile

import (
	"context"
	"errors"
	"time"

	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/store"
)

// Run executes the reconciler loop until ctx is cancelled, ticking every
// interval. It runs one tick immediately on start.
func (r *Reconciler) Run(ctx context.Context, interval time.Duration) error {
	t := time.NewTicker(interval)
	defer t.Stop()
	r.Tick(ctx)
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
			r.Tick(ctx)
		}
	}
}

// Tick enforces desired vs actual state once: it sleeps idle previews, destroys
// past-TTL ones, and reaps orphaned containers.
func (r *Reconciler) Tick(ctx context.Context) {
	now := r.now()
	previews, err := r.store.List()
	if err != nil {
		r.logger.Error("reconciler list", "err", err)
		return
	}
	for _, p := range previews {
		if p.Status == model.StatusDestroyed {
			continue
		}
		if p.Expired(now) {
			if err := r.teardownPreview(ctx, p); err != nil {
				r.logger.Error("ttl teardown", "host", p.Host, "err", err)
			}
			continue
		}
		if p.IdleSince(now) {
			r.sleep(ctx, p)
		}
	}
	r.reapOrphans(ctx)
}

func (r *Reconciler) sleep(ctx context.Context, p *model.Preview) {
	r.logger.Info("sleeping idle preview", "host", p.Host)
	if err := r.runtime.Stop(ctx, p.ContainerID); err != nil {
		r.logger.Error("sleep stop", "host", p.Host, "err", err)
		return
	}
	p.Status = model.StatusSleeping
	if err := r.store.Put(p); err != nil {
		r.logger.Error("sleep persist", "host", p.Host, "err", err)
	}
}

// reapOrphans removes managed containers that have no live preview record
// (missed close events, stale state).
func (r *Reconciler) reapOrphans(ctx context.Context) {
	containers, err := r.runtime.ListManaged(ctx)
	if err != nil {
		r.logger.Warn("list managed containers", "err", err)
		return
	}
	for _, c := range containers {
		p, err := r.store.Get(c.Repo, c.PR, c.App)
		orphan := errors.Is(err, store.ErrNotFound) || (p != nil && p.Status == model.StatusDestroyed)
		if orphan {
			r.logger.Info("reaping orphan container", "name", c.Name)
			_ = r.runtime.Remove(ctx, c.ID)
		}
	}
}
