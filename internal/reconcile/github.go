package reconcile

import (
	"context"
	"errors"

	"github.com/RedBoardDev/prevly/internal/config"
	gh "github.com/RedBoardDev/prevly/internal/github"
	"github.com/RedBoardDev/prevly/internal/model"
)

// ErrConfigNotFound means the repo has no .prevly.yml (it is simply not
// onboarded), as opposed to a present-but-invalid config.
var ErrConfigNotFound = errors.New("no .prevly.yml in repo")

// GitHub is the subset of the GitHub App the reconciler depends on. It is an
// interface so the orchestration can be tested with a fake.
type GitHub interface {
	ChangedFiles(ctx context.Context, installationID int64, owner, repo string, pr int) ([]string, error)
	RepoConfig(ctx context.Context, installationID int64, owner, repo, ref string) (*config.RepoConfig, error)
	PullRequest(ctx context.Context, installationID int64, owner, repo string, pr int) (*gh.PullRequestEvent, error)
	CloneToken(ctx context.Context, installationID int64) (string, error)
	UpsertComment(ctx context.Context, installationID int64, owner, repo string, pr int, body string) (int64, error)
	Reply(ctx context.Context, installationID int64, owner, repo string, pr int, body string) error
	CreateDeployment(ctx context.Context, installationID int64, owner, repo, ref, environment string) (int64, error)
	SetDeploymentStatus(ctx context.Context, installationID int64, owner, repo string, deploymentID int64, status model.Status, url string) error
}

// appGitHub adapts a *github.App to the GitHub interface using installation-
// scoped clients.
type appGitHub struct {
	app *gh.App
}

// NewAppGitHub builds a GitHub backed by the real App.
func NewAppGitHub(app *gh.App) GitHub { return &appGitHub{app: app} }

func (a *appGitHub) ChangedFiles(ctx context.Context, installationID int64, owner, repo string, pr int) ([]string, error) {
	return gh.ListChangedFiles(ctx, a.app.Client(installationID), owner, repo, pr)
}

func (a *appGitHub) RepoConfig(ctx context.Context, installationID int64, owner, repo, ref string) (*config.RepoConfig, error) {
	data, err := gh.FetchFile(ctx, a.app.Client(installationID), owner, repo, ".prevly.yml", ref)
	if errors.Is(err, gh.ErrFileNotFound) {
		return nil, ErrConfigNotFound
	}
	if err != nil {
		return nil, err
	}
	return config.ParseRepoConfig(data)
}

func (a *appGitHub) PullRequest(ctx context.Context, installationID int64, owner, repo string, pr int) (*gh.PullRequestEvent, error) {
	return gh.GetPullRequest(ctx, a.app.Client(installationID), owner, repo, pr)
}

func (a *appGitHub) CloneToken(ctx context.Context, installationID int64) (string, error) {
	return a.app.InstallationToken(ctx, installationID)
}

func (a *appGitHub) UpsertComment(ctx context.Context, installationID int64, owner, repo string, pr int, body string) (int64, error) {
	return gh.NewFeedback(a.app.Client(installationID)).UpsertComment(ctx, owner, repo, pr, body)
}

func (a *appGitHub) Reply(ctx context.Context, installationID int64, owner, repo string, pr int, body string) error {
	return gh.NewFeedback(a.app.Client(installationID)).Reply(ctx, owner, repo, pr, body)
}

func (a *appGitHub) CreateDeployment(ctx context.Context, installationID int64, owner, repo, ref, environment string) (int64, error) {
	return gh.NewFeedback(a.app.Client(installationID)).CreateDeployment(ctx, owner, repo, ref, environment)
}

func (a *appGitHub) SetDeploymentStatus(ctx context.Context, installationID int64, owner, repo string, deploymentID int64, status model.Status, url string) error {
	return gh.NewFeedback(a.app.Client(installationID)).SetDeploymentStatus(ctx, owner, repo, deploymentID, status, url)
}
