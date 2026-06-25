package reconcile

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/runtime"
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

	managed, err := r.runtime.ListManaged(ctx)
	if err != nil {
		r.logger.Warn("list managed containers", "err", err)
		managed = nil
	}
	existing := make(map[string]bool, len(managed))
	for _, c := range managed {
		existing[c.Name] = true
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
		// Self-heal: the store says this preview is alive but its container is
		// gone (e.g. an external `docker prune` removed it). Recreate it from the
		// image so the store stays the source of truth.
		if (p.Status == model.StatusRunning || p.Status == model.StatusSleeping) &&
			!existing[model.ContainerName(p.Repo, p.PRNumber, p.AppName)] {
			r.healMissing(ctx, p)
			continue
		}
		if p.IdleSince(now) {
			r.sleep(ctx, p)
		}
	}
	r.reapOrphans(ctx, managed)
	r.reapOrphanWorkDirs(previews, managed)
	r.maybePrune(ctx)
}

// healMissing recreates a preview whose container vanished (e.g. an external
// docker prune). Records lacking recreate metadata (created before this was
// recorded) are left untouched for a redeploy to repopulate. If the image is
// gone, the preview is marked failed so the PR shows it needs a redeploy.
func (r *Reconciler) healMissing(ctx context.Context, p *model.Preview) {
	if p.ImageTag == "" || p.ContainerPort == 0 {
		r.logger.Warn("preview container missing; redeploy needed to recreate", "host", p.Host)
		return
	}
	r.logger.Warn("preview container missing; recreating from image", "host", p.Host)
	if err := r.recreateFromImage(ctx, p); err != nil {
		r.logger.Error("heal recreate", "host", p.Host, "err", err)
		p.Status = model.StatusFailed
		p.FailureLog = "preview container was removed and could not be recreated: " + err.Error()
		_ = r.store.Put(p)
		r.publishPreview(ctx, p)
		return
	}
	p.Status = model.StatusRunning
	p.LastSeenAt = r.now()
	if err := r.store.Put(p); err != nil {
		r.logger.Error("heal persist", "host", p.Host, "err", err)
		return
	}
	r.publishPreview(ctx, p)
	r.logger.Info("preview recreated after container loss", "host", p.Host)
}

// maybePrune reclaims dangling images and build cache at most once per
// pruneEvery window to keep host disk usage bounded.
func (r *Reconciler) maybePrune(ctx context.Context) {
	if r.now().Sub(r.lastPruneAt) < r.pruneEvery {
		return
	}
	r.lastPruneAt = r.now()
	if err := r.runtime.PruneDangling(ctx); err != nil {
		r.logger.Warn("prune dangling", "err", err)
	}
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
		return
	}
	r.publishPreview(ctx, p) // reflect 💤 sleeping on the PR
}

// reapOrphans removes managed containers that have no live preview record
// (missed close events, stale state).
func (r *Reconciler) reapOrphans(ctx context.Context, containers []runtime.Container) {
	for _, c := range containers {
		p, err := r.store.Get(c.Repo, c.PR, c.App)
		orphan := errors.Is(err, store.ErrNotFound) || (p != nil && p.Status == model.StatusDestroyed)
		if orphan {
			r.logger.Info("reaping orphan container", "name", c.Name)
			_ = r.runtime.Remove(ctx, c.ID)
		}
	}
}

// reapOrphanWorkDirs removes checkout dirs under workDir that no live preview
// record or managed container references. This reclaims disk for previews whose
// record was already deleted (closed/torn-down PRs, de-onboarded repos) — the
// case teardownPreview's own cleanup can no longer reach. A preview mid-build
// already has a (non-destroyed) record, so it is never reaped from under a build.
func (r *Reconciler) reapOrphanWorkDirs(previews []*model.Preview, managed []runtime.Container) {
	keep := make(map[string]bool, len(previews)+len(managed))
	for _, p := range previews {
		if p.Status != model.StatusDestroyed {
			keep[model.ContainerName(p.Repo, p.PRNumber, p.AppName)] = true
		}
	}
	for _, c := range managed {
		keep[c.Name] = true
	}
	entries, err := os.ReadDir(r.workDir)
	if err != nil {
		if !os.IsNotExist(err) {
			r.logger.Warn("read work dir", "dir", r.workDir, "err", err)
		}
		return
	}
	for _, e := range entries {
		if !e.IsDir() || keep[e.Name()] {
			continue
		}
		dir := filepath.Join(r.workDir, e.Name())
		r.logger.Info("reaping orphan work dir", "dir", dir)
		if err := os.RemoveAll(dir); err != nil {
			r.logger.Warn("remove orphan work dir", "dir", dir, "err", err)
		}
	}
}
