package reconcile

import (
	"context"
	"io"
	"path/filepath"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/config"
	applog "github.com/RedBoardDev/prevly/internal/log"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/secrets"
	"github.com/RedBoardDev/prevly/internal/store"
)

type teardownCall struct {
	repo string
	pr   int
	app  string
}

func newHookedReconciler(t *testing.T, d *Deps) (*Reconciler, *store.Store) {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "state.db"))
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })

	d.Config = &config.HostConfig{
		BaseDomain: "preview.example.com",
		Limits:     config.Limits{MaxConcurrentBuilds: 1, MaxConcurrentPreviews: 2},
		Defaults:   config.Defaults{TTL: config.Duration(30 * 24 * time.Hour), Idle: config.Duration(6 * time.Hour)},
	}
	d.Store = st
	d.Builder = &fakeBuilder{}
	d.Runtime = &fakeRuntime{}
	d.Secrets = secrets.New(nil, func(string) (string, bool) { return "", false })
	d.GitHub = &fakeGitHub{}
	d.Logger = applog.New(applog.Options{Level: "error", Out: io.Discard})
	d.WorkDir = t.TempDir()
	return New(*d), st
}

func TestTeardownCallsOnTeardownHook(t *testing.T) {
	t.Parallel()
	var calls []teardownCall
	deps := &Deps{OnTeardown: func(repo string, pr int, app string) {
		calls = append(calls, teardownCall{repo, pr, app})
	}}
	rec, st := newHookedReconciler(t, deps)

	if err := st.Put(&model.Preview{
		Repo: "org/repo", PRNumber: 42, AppName: "web",
		Host: "pr-42-web.preview.example.com", Status: model.StatusRunning,
	}); err != nil {
		t.Fatalf("put: %v", err)
	}
	if _, err := rec.Teardown(context.Background(), "org/repo", 42, ""); err != nil {
		t.Fatalf("teardown: %v", err)
	}
	if len(calls) != 1 || calls[0] != (teardownCall{"org/repo", 42, "web"}) {
		t.Fatalf("hook calls = %+v", calls)
	}
}

func TestLoopTickRunsFeedbackTick(t *testing.T) {
	t.Parallel()
	var ticks int
	deps := &Deps{FeedbackTick: func(context.Context) { ticks++ }}
	rec, _ := newHookedReconciler(t, deps)

	rec.Tick(context.Background())
	rec.Tick(context.Background())
	if ticks != 2 {
		t.Fatalf("feedback ticks = %d, want 2", ticks)
	}
}

func TestFeedbackURL(t *testing.T) {
	t.Parallel()
	rec, _ := newHookedReconciler(t, &Deps{})

	live := &model.Preview{
		Status: model.StatusRunning, URL: "https://pr-42-web.preview.example.com",
		FeedbackEnabled: true,
	}
	if got := rec.feedbackURL(live); got != "https://pr-42-web.preview.example.com/?prevly_feedback=1" {
		t.Fatalf("feedbackURL = %q", got)
	}

	sleeping := *live
	sleeping.Status = model.StatusSleeping
	if rec.feedbackURL(&sleeping) == "" {
		t.Fatal("a sleeping preview still takes feedback")
	}

	optedOut := *live
	optedOut.FeedbackEnabled = false
	if got := rec.feedbackURL(&optedOut); got != "" {
		t.Fatalf("opted-out repo: feedbackURL = %q", got)
	}

	failed := *live
	failed.Status = model.StatusFailed
	if got := rec.feedbackURL(&failed); got != "" {
		t.Fatalf("failed preview: feedbackURL = %q", got)
	}

	off := false
	rec.cfg.Feedback.Enabled = &off
	if got := rec.feedbackURL(live); got != "" {
		t.Fatalf("host-wide off: feedbackURL = %q", got)
	}
}

func TestDeploySnapshotsRepoOptIn(t *testing.T) {
	t.Parallel()
	optOut := false
	cfg := singleAppCfg()
	cfg.Feedback = &optOut
	rec, _ := newHookedReconciler(t, &Deps{})

	p := rec.upsertBuilding(openedEvent(), cfg, cfg.Apps[0], "h", "https://h", nil)
	if p.FeedbackEnabled {
		t.Fatal("repo opt-out must be recorded on the preview")
	}

	p = rec.upsertBuilding(openedEvent(), singleAppCfg(), cfg.Apps[0], "h", "https://h", nil)
	if !p.FeedbackEnabled {
		t.Fatal("default repo config must record the opt-in")
	}
}
