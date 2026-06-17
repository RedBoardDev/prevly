package reconcile

import (
	"context"
	"io"
	"net"
	"path/filepath"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/builder"
	"github.com/RedBoardDev/prevly/internal/config"
	gh "github.com/RedBoardDev/prevly/internal/github"
	applog "github.com/RedBoardDev/prevly/internal/log"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/runtime"
	"github.com/RedBoardDev/prevly/internal/secrets"
	"github.com/RedBoardDev/prevly/internal/store"
)

// --- fakes ---

type fakeRuntime struct {
	runID   string
	runPort int
	runErr  error

	managed []runtime.Container

	started  []string
	stopped  []string
	removed  []string
	netCreat []string
	netRm    []string
	imgRm    []string
}

func (f *fakeRuntime) EnsureNetwork(_ context.Context, n string) error {
	f.netCreat = append(f.netCreat, n)
	return nil
}
func (f *fakeRuntime) RemoveNetwork(_ context.Context, n string) error {
	f.netRm = append(f.netRm, n)
	return nil
}
func (f *fakeRuntime) Run(_ context.Context, spec runtime.RunSpec) (string, int, error) {
	if f.runErr != nil {
		return "", 0, f.runErr
	}
	return f.runID, f.runPort, nil
}
func (f *fakeRuntime) Start(_ context.Context, id string) error {
	f.started = append(f.started, id)
	return nil
}
func (f *fakeRuntime) Stop(_ context.Context, id string) error {
	f.stopped = append(f.stopped, id)
	return nil
}
func (f *fakeRuntime) Remove(_ context.Context, id string) error {
	f.removed = append(f.removed, id)
	return nil
}
func (f *fakeRuntime) RemoveImage(_ context.Context, i string) error {
	f.imgRm = append(f.imgRm, i)
	return nil
}
func (f *fakeRuntime) ListManaged(context.Context) ([]runtime.Container, error) {
	return f.managed, nil
}

type fakeBuilder struct {
	buildErr    error
	checkoutErr error
}

func (f *fakeBuilder) Checkout(context.Context, builder.CheckoutOptions) error { return f.checkoutErr }
func (f *fakeBuilder) Build(_ context.Context, spec builder.BuildSpec) (builder.BuildResult, error) {
	return builder.BuildResult{ImageTag: spec.ImageTag, Log: "log"}, f.buildErr
}

type fakeGitHub struct {
	changed    []string
	repoCfg    *config.RepoConfig
	repoCfgErr error
	pr         *gh.PullRequestEvent

	comments    int
	deployments int
	statuses    []model.Status
}

func (f *fakeGitHub) ChangedFiles(context.Context, int64, string, string, int) ([]string, error) {
	return f.changed, nil
}
func (f *fakeGitHub) RepoConfig(context.Context, int64, string, string, string) (*config.RepoConfig, error) {
	return f.repoCfg, f.repoCfgErr
}
func (f *fakeGitHub) PullRequest(context.Context, int64, string, string, int) (*gh.PullRequestEvent, error) {
	return f.pr, nil
}
func (f *fakeGitHub) CloneToken(context.Context, int64) (string, error) { return "tok", nil }
func (f *fakeGitHub) UpsertComment(context.Context, int64, string, string, int, string) (int64, error) {
	f.comments++
	return 1, nil
}
func (f *fakeGitHub) CreateDeployment(context.Context, int64, string, string, string, string) (int64, error) {
	f.deployments++
	return 99, nil
}
func (f *fakeGitHub) SetDeploymentStatus(_ context.Context, _ int64, _, _ string, _ int64, status model.Status, _ string) error {
	f.statuses = append(f.statuses, status)
	return nil
}

// --- helpers ---

func newTestReconciler(t *testing.T, gh GitHub, rt runtime.Runtime, bld builder.Builder) (*Reconciler, *store.Store) {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "state.db"))
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	cfg := &config.HostConfig{
		BaseDomain: "preview.example.com",
		Limits:     config.Limits{MaxConcurrentBuilds: 1, MaxConcurrentPreviews: 2},
		Defaults:   config.Defaults{TTL: config.Duration(30 * 24 * time.Hour), Idle: config.Duration(6 * time.Hour)},
	}
	rec := New(Deps{
		Config:  cfg,
		Store:   st,
		Builder: bld,
		Runtime: rt,
		Secrets: secrets.New(nil, func(string) (string, bool) { return "", false }),
		GitHub:  gh,
		Logger:  applog.New(applog.Options{Level: "error", Out: io.Discard}),
		WorkDir: t.TempDir(),
	})
	return rec, st
}

func singleAppCfg() *config.RepoConfig {
	return &config.RepoConfig{
		Version:  1,
		Triggers: config.Triggers{TargetBranches: []string{"main"}},
		Apps: []config.AppConfig{
			{Name: "web", Port: 3000, Dockerfile: "Dockerfile", Context: ".", Paths: []string{"**"}},
		},
	}
}

func openedEvent() *gh.PullRequestEvent {
	return &gh.PullRequestEvent{
		Action: "opened", Repo: "org/repo", Owner: "org", Name: "repo", Number: 42,
		BaseBranch: "main", HeadBranch: "feature/x", HeadSHA: "abcdef1234567890",
		CloneURL: "https://github.com/org/repo.git", AuthorAssociation: "MEMBER", InstallationID: 7,
	}
}

// --- tests ---

func TestDeployHappyPath(t *testing.T) {
	t.Parallel()
	fg := &fakeGitHub{changed: []string{"src/app.tsx"}, repoCfg: singleAppCfg()}
	frt := &fakeRuntime{runID: "cid", runPort: 40555}
	rec, st := newTestReconciler(t, fg, frt, &fakeBuilder{})

	if err := rec.HandlePullRequest(context.Background(), openedEvent()); err != nil {
		t.Fatalf("handle: %v", err)
	}
	p, err := st.Get("org/repo", 42, "web")
	if err != nil {
		t.Fatalf("get preview: %v", err)
	}
	if p.Status != model.StatusRunning {
		t.Fatalf("status = %q, want running", p.Status)
	}
	if p.Port != 40555 || p.ContainerID != "cid" {
		t.Fatalf("container not recorded: %+v", p)
	}
	if p.Host != "pr-42.preview.example.com" {
		t.Fatalf("host = %q", p.Host)
	}
	if fg.deployments != 1 {
		t.Fatalf("expected one deployment, got %d", fg.deployments)
	}
	if len(fg.statuses) == 0 || fg.statuses[len(fg.statuses)-1] != model.StatusRunning {
		t.Fatalf("final deployment status not success: %v", fg.statuses)
	}
}

func TestForkPRGated(t *testing.T) {
	t.Parallel()
	fg := &fakeGitHub{changed: []string{"src/x"}, repoCfg: singleAppCfg()}
	frt := &fakeRuntime{runID: "cid", runPort: 1}
	rec, st := newTestReconciler(t, fg, frt, &fakeBuilder{})

	ev := openedEvent()
	ev.FromFork = true
	ev.AuthorAssociation = "CONTRIBUTOR"
	if err := rec.HandlePullRequest(context.Background(), ev); err != nil {
		t.Fatalf("handle: %v", err)
	}
	if previews, _ := st.ListByPR("org/repo", 42); len(previews) != 0 {
		t.Fatalf("fork PR must not create previews, got %d", len(previews))
	}
}

func TestBuildFailureMarksFailed(t *testing.T) {
	t.Parallel()
	fg := &fakeGitHub{changed: []string{"x"}, repoCfg: singleAppCfg()}
	rec, st := newTestReconciler(t, fg, &fakeRuntime{}, &fakeBuilder{buildErr: context.DeadlineExceeded})

	_ = rec.HandlePullRequest(context.Background(), openedEvent())
	p, err := st.Get("org/repo", 42, "web")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if p.Status != model.StatusFailed {
		t.Fatalf("status = %q, want failed", p.Status)
	}
}

func TestPRClosedTeardown(t *testing.T) {
	t.Parallel()
	fg := &fakeGitHub{changed: []string{"x"}, repoCfg: singleAppCfg()}
	frt := &fakeRuntime{runID: "cid", runPort: 2}
	rec, st := newTestReconciler(t, fg, frt, &fakeBuilder{})
	_ = rec.HandlePullRequest(context.Background(), openedEvent())

	closed := openedEvent()
	closed.Action = "closed"
	if err := rec.HandlePullRequest(context.Background(), closed); err != nil {
		t.Fatalf("close: %v", err)
	}
	if previews, _ := st.ListByPR("org/repo", 42); len(previews) != 0 {
		t.Fatalf("previews should be gone after close, got %d", len(previews))
	}
	if len(frt.removed) == 0 {
		t.Fatal("container should have been removed")
	}
}

func TestTickSleepsIdle(t *testing.T) {
	t.Parallel()
	frt := &fakeRuntime{}
	rec, st := newTestReconciler(t, &fakeGitHub{}, frt, &fakeBuilder{})
	now := time.Now()
	rec.now = func() time.Time { return now }

	p := &model.Preview{Repo: "org/repo", PRNumber: 1, AppName: "web", ContainerID: "cid",
		Status: model.StatusRunning, Idle: time.Hour, TTL: 30 * 24 * time.Hour, LastSeenAt: now.Add(-2 * time.Hour)}
	_ = st.Put(p)

	rec.Tick(context.Background())
	got, _ := st.Get("org/repo", 1, "web")
	if got.Status != model.StatusSleeping {
		t.Fatalf("status = %q, want sleeping", got.Status)
	}
	if len(frt.stopped) != 1 {
		t.Fatalf("container should be stopped once, got %d", len(frt.stopped))
	}
}

func TestTickDestroysExpired(t *testing.T) {
	t.Parallel()
	frt := &fakeRuntime{}
	rec, st := newTestReconciler(t, &fakeGitHub{}, frt, &fakeBuilder{})
	now := time.Now()
	rec.now = func() time.Time { return now }

	p := &model.Preview{Repo: "org/repo", PRNumber: 1, AppName: "web", ContainerID: "cid",
		Status: model.StatusSleeping, TTL: 24 * time.Hour, LastSeenAt: now.Add(-48 * time.Hour)}
	_ = st.Put(p)

	rec.Tick(context.Background())
	if _, err := st.Get("org/repo", 1, "web"); err == nil {
		t.Fatal("expired preview should be deleted")
	}
	if len(frt.removed) == 0 {
		t.Fatal("expired container should be removed")
	}
}

func TestReapOrphans(t *testing.T) {
	t.Parallel()
	frt := &fakeRuntime{managed: []runtime.Container{
		{ID: "orphan", Name: "prevly-orphan", Repo: "org/gone", PR: 5, App: "web"},
	}}
	rec, _ := newTestReconciler(t, &fakeGitHub{}, frt, &fakeBuilder{})

	rec.reapOrphans(context.Background())
	if len(frt.removed) != 1 || frt.removed[0] != "orphan" {
		t.Fatalf("orphan should be removed, got %v", frt.removed)
	}
}

func TestResolveWakesSleeping(t *testing.T) {
	t.Parallel()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()
	port := ln.Addr().(*net.TCPAddr).Port

	frt := &fakeRuntime{}
	rec, st := newTestReconciler(t, &fakeGitHub{}, frt, &fakeBuilder{})
	p := &model.Preview{Repo: "org/repo", PRNumber: 1, AppName: "web", ContainerID: "cid",
		Host: "pr-1.preview.example.com", Status: model.StatusSleeping, Port: port}
	_ = st.Put(p)

	target, ok, err := rec.Resolve(context.Background(), "pr-1.preview.example.com")
	if err != nil || !ok {
		t.Fatalf("resolve: ok=%v err=%v", ok, err)
	}
	if target.Upstream == "" {
		t.Fatal("expected upstream")
	}
	if len(frt.started) != 1 {
		t.Fatalf("container should be started, got %v", frt.started)
	}
	got, _ := st.Get("org/repo", 1, "web")
	if got.Status != model.StatusRunning {
		t.Fatalf("woken preview should be running, got %q", got.Status)
	}
}

func TestResolveUnknownHost(t *testing.T) {
	t.Parallel()
	rec, _ := newTestReconciler(t, &fakeGitHub{}, &fakeRuntime{}, &fakeBuilder{})
	_, ok, err := rec.Resolve(context.Background(), "nope.example.com")
	if err != nil || ok {
		t.Fatalf("unknown host should be ok=false err=nil, got ok=%v err=%v", ok, err)
	}
}

func TestCapacityLimit(t *testing.T) {
	t.Parallel()
	fg := &fakeGitHub{changed: []string{"x"}, repoCfg: singleAppCfg()}
	frt := &fakeRuntime{runID: "cid", runPort: 3}
	rec, st := newTestReconciler(t, fg, frt, &fakeBuilder{})

	// Fill capacity (max 2) with unrelated previews.
	_ = st.Put(&model.Preview{Repo: "org/a", PRNumber: 1, AppName: "x", Status: model.StatusRunning, Host: "a"})
	_ = st.Put(&model.Preview{Repo: "org/b", PRNumber: 1, AppName: "y", Status: model.StatusRunning, Host: "b"})

	err := rec.deployApp(context.Background(), openedEvent(), singleAppCfg(), singleAppCfg().Apps[0])
	if err == nil {
		t.Fatal("expected capacity error")
	}
}

func TestChatOpsRedeployUntrustedDenied(t *testing.T) {
	t.Parallel()
	fg := &fakeGitHub{}
	rec, st := newTestReconciler(t, fg, &fakeRuntime{}, &fakeBuilder{})
	ev := &gh.IssueCommentEvent{Action: "created", IsPullRequest: true, Repo: "org/repo", Owner: "org", Name: "repo",
		Number: 42, Body: "/preview redeploy", AuthorAssociation: "CONTRIBUTOR", InstallationID: 7}
	if err := rec.HandleIssueComment(context.Background(), ev); err != nil {
		t.Fatalf("handle: %v", err)
	}
	if previews, _ := st.ListByPR("org/repo", 42); len(previews) != 0 {
		t.Fatal("untrusted redeploy must do nothing")
	}
}
