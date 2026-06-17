// Package reconcile is prevly's control loop. It implements the GitHub webhook
// handler and the ingress resolver, drives the build/run/teardown pipeline, and
// runs the periodic reconciler that enforces desired vs actual state: sleeping
// idle previews, destroying past-TTL ones, and reaping orphans. The bbolt store
// is the source of truth; webhooks are best-effort and healed here.
package reconcile

import (
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
}

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
