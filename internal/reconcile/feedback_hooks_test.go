package reconcile

import (
	"context"
	"io"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/config"
	applog "github.com/RedBoardDev/prevly/internal/log"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/runtime"
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
	if d.Builder == nil {
		d.Builder = &fakeBuilder{}
	}
	if d.Runtime == nil {
		d.Runtime = &fakeRuntime{}
	}
	if d.Secrets == nil {
		d.Secrets = secrets.New(nil, func(string) (string, bool) { return "", false })
	}
	if d.GitHub == nil {
		d.GitHub = &fakeGitHub{}
	}
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

func TestDeploySnapshotsRepoOptIn(t *testing.T) {
	t.Parallel()
	optOut := false
	cfg := singleAppCfg()
	cfg.Feedback = &optOut
	rec, _ := newHookedReconciler(t, &Deps{})

	p := rec.upsertBuilding(openedEvent(), cfg, cfg.Apps[0], "h", "https://h", nil)
	if p.FeedbackOn() {
		t.Fatal("repo opt-out must be recorded on the preview")
	}

	p = rec.upsertBuilding(openedEvent(), singleAppCfg(), cfg.Apps[0], "h", "https://h", nil)
	if !p.FeedbackOn() {
		t.Fatal("default repo config must record the opt-in")
	}
}

// TestDeployGeneratesFeedbackTokenOnce proves the token is created the first
// time a preview is deployed and never changes on a redeploy: the activation
// link already posted to the pull request must keep working.
func TestDeployGeneratesFeedbackTokenOnce(t *testing.T) {
	t.Parallel()
	rec, _ := newHookedReconciler(t, &Deps{})

	p := rec.upsertBuilding(openedEvent(), singleAppCfg(), singleAppCfg().Apps[0], "h", "https://h", nil)
	if p.FeedbackToken == "" {
		t.Fatal("a first deploy must generate a feedback token")
	}
	first := p.FeedbackToken

	p = rec.upsertBuilding(openedEvent(), singleAppCfg(), singleAppCfg().Apps[0], "h", "https://h", p)
	if p.FeedbackToken != first {
		t.Fatalf("token changed across redeploys: %q -> %q", first, p.FeedbackToken)
	}
}

// TestBackfillFeedbackTokenOnTick proves the reconcile loop issues a missing
// token for a preview stored before the field existed and republishes the
// sticky comment exactly once, instead of leaving the activation link dead
// forever the way a plain bool once left feedback silently disabled.
func TestBackfillFeedbackTokenOnTick(t *testing.T) {
	t.Parallel()
	fg := &fakeGitHub{}
	name := model.ContainerName("org/repo", 42, "web")
	frt := &fakeRuntime{managed: []runtime.Container{{Name: name, Repo: "org/repo", PR: 42, App: "web"}}}
	rec, st := newHookedReconciler(t, &Deps{GitHub: fg, Runtime: frt})

	p := &model.Preview{
		Repo: "org/repo", PRNumber: 42, AppName: "web",
		Host: "pr-42-web.preview.example.com", URL: "https://pr-42-web.preview.example.com",
		Status: model.StatusRunning, InstallationID: 7,
	}
	if err := st.Put(p); err != nil {
		t.Fatalf("put: %v", err)
	}

	rec.Tick(context.Background())

	got, err := st.Get("org/repo", 42, "web")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.FeedbackToken == "" {
		t.Fatal("backfill must generate a token for a pre-existing preview")
	}
	if fg.comments != 1 {
		t.Fatalf("sticky comment posts = %d, want exactly 1", fg.comments)
	}
	if len(fg.commentBody) != 1 || !strings.Contains(fg.commentBody[0], got.FeedbackToken) {
		t.Fatalf("republished comment must carry the new activation link: %+v", fg.commentBody)
	}

	rec.Tick(context.Background())
	if fg.comments != 1 {
		t.Fatalf("a second tick must not re-post once the token is set: comments = %d", fg.comments)
	}
}

// TestBackfillFeedbackTokenSkipsOptedOutAndDestroyed proves the backfill does
// not manufacture a token where it serves no purpose: feedback disabled, or
// the preview already destroyed.
func TestBackfillFeedbackTokenSkipsOptedOutAndDestroyed(t *testing.T) {
	t.Parallel()
	fg := &fakeGitHub{}
	frt := &fakeRuntime{managed: []runtime.Container{
		{Name: model.ContainerName("org/repo", 42, "web"), Repo: "org/repo", PR: 42, App: "web"},
	}}
	rec, st := newHookedReconciler(t, &Deps{GitHub: fg, Runtime: frt})

	off := boolPtr(false)
	optedOut := &model.Preview{
		Repo: "org/repo", PRNumber: 42, AppName: "web",
		Host: "pr-42-web.preview.example.com", Status: model.StatusRunning,
		FeedbackEnabled: off,
	}
	destroyed := &model.Preview{
		Repo: "org/repo", PRNumber: 43, AppName: "web",
		Host: "pr-43-web.preview.example.com", Status: model.StatusDestroyed,
	}
	for _, p := range []*model.Preview{optedOut, destroyed} {
		if err := st.Put(p); err != nil {
			t.Fatalf("put: %v", err)
		}
	}

	rec.Tick(context.Background())

	for _, key := range []struct{ pr int }{{42}, {43}} {
		got, err := st.Get("org/repo", key.pr, "web")
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		if got.FeedbackToken != "" {
			t.Fatalf("pr %d must not receive a token: %+v", key.pr, got)
		}
	}
	if fg.comments != 0 {
		t.Fatalf("neither case should republish a comment: comments = %d", fg.comments)
	}
}

func boolPtr(b bool) *bool { return &b }
