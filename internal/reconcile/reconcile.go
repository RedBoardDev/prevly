// Package reconcile is prevly's control loop. It implements the GitHub webhook
// handler and the ingress resolver, drives the build/run/teardown pipeline, and
// runs the periodic reconciler that enforces desired vs actual state: sleeping
// idle previews, destroying past-TTL ones, and reaping orphans. The bbolt store
// is the source of truth; webhooks are best-effort and healed here.
package reconcile

import (
	"sync"
	"time"

	"github.com/RedBoardDev/prevly/internal/builder"
	"github.com/RedBoardDev/prevly/internal/config"
	applog "github.com/RedBoardDev/prevly/internal/log"
	"github.com/RedBoardDev/prevly/internal/runtime"
	"github.com/RedBoardDev/prevly/internal/secrets"
	"github.com/RedBoardDev/prevly/internal/store"
)

// Deps are the reconciler's collaborators.
type Deps struct {
	Config  *config.HostConfig
	Store   *store.Store
	Builder builder.Builder
	Runtime runtime.Runtime
	Secrets *secrets.Resolver
	GitHub  GitHub
	Logger  *applog.Logger
	WorkDir string // base dir for PR checkouts
}

// Reconciler orchestrates the preview lifecycle.
type Reconciler struct {
	cfg      *config.HostConfig
	store    *store.Store
	builder  builder.Builder
	runtime  runtime.Runtime
	secrets  *secrets.Resolver
	gh       GitHub
	logger   *applog.Logger
	workDir  string
	buildSem chan struct{}

	// readyTimeout bounds the post-deploy readiness wait.
	readyTimeout time.Duration

	// pruneEvery throttles dangling image / build-cache pruning.
	pruneEvery  time.Duration
	lastPruneAt time.Time

	// now is injectable for deterministic tests.
	now func() time.Time

	// closedPRs remembers the PRs whose `closed` webhook already landed, so a
	// build still queued behind buildSem does not deploy a preview nothing will
	// ever tear down again. Entries expire after closedMemory.
	closedMu  sync.Mutex
	closedPRs map[prKey]time.Time
}

type prKey struct {
	repo string
	pr   int
}

// closedMemory bounds how long a closed PR is remembered - long enough to
// outlive any build queued behind the semaphore.
const closedMemory = 12 * time.Hour

// New builds a Reconciler.
func New(d Deps) *Reconciler {
	builds := max(d.Config.Limits.MaxConcurrentBuilds, 1)
	workDir := d.WorkDir
	if workDir == "" {
		workDir = d.Config.DataDir + "/work"
	}
	return &Reconciler{
		cfg:          d.Config,
		store:        d.Store,
		builder:      d.Builder,
		runtime:      d.Runtime,
		secrets:      d.Secrets,
		gh:           d.GitHub,
		logger:       d.Logger,
		workDir:      workDir,
		buildSem:     make(chan struct{}, builds),
		readyTimeout: 30 * time.Second,
		pruneEvery:   24 * time.Hour,
		lastPruneAt:  time.Now(),
		now:          time.Now,
		closedPRs:    map[prKey]time.Time{},
	}
}

// ttlFor returns the effective TTL for a repo config, falling back to host
// defaults.
func (r *Reconciler) ttlFor(repoCfg *config.RepoConfig) time.Duration {
	if repoCfg != nil && repoCfg.TTL > 0 {
		return repoCfg.TTL.Std()
	}
	return r.cfg.Defaults.TTL.Std()
}

// idleFor returns the effective idle window for a repo config.
func (r *Reconciler) idleFor(repoCfg *config.RepoConfig) time.Duration {
	if repoCfg != nil && repoCfg.Idle > 0 {
		return repoCfg.Idle.Std()
	}
	return r.cfg.Defaults.Idle.Std()
}

// markClosed records a PR as closed and forgets stale entries.
func (r *Reconciler) markClosed(repo string, pr int) {
	r.closedMu.Lock()
	defer r.closedMu.Unlock()
	cutoff := r.now().Add(-closedMemory)
	for k, at := range r.closedPRs {
		if at.Before(cutoff) {
			delete(r.closedPRs, k)
		}
	}
	r.closedPRs[prKey{repo: repo, pr: pr}] = r.now()
}

// markOpen forgets a PR that was closed and is open again.
func (r *Reconciler) markOpen(repo string, pr int) {
	r.closedMu.Lock()
	defer r.closedMu.Unlock()
	delete(r.closedPRs, prKey{repo: repo, pr: pr})
}

func (r *Reconciler) isClosed(repo string, pr int) bool {
	r.closedMu.Lock()
	defer r.closedMu.Unlock()
	at, ok := r.closedPRs[prKey{repo: repo, pr: pr}]
	return ok && at.After(r.now().Add(-closedMemory))
}
