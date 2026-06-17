package reconcile

import (
	"context"
	"errors"

	"github.com/RedBoardDev/prevly/internal/config"
	gh "github.com/RedBoardDev/prevly/internal/github"
)

// HandlePullRequest reacts to pull_request webhooks. It implements
// github.EventHandler.
func (r *Reconciler) HandlePullRequest(ctx context.Context, ev *gh.PullRequestEvent) error {
	switch ev.Action {
	case "closed":
		n, err := r.teardownPR(ctx, ev.Repo, ev.Number, "")
		if err != nil {
			return err
		}
		r.logger.Info("PR closed; previews destroyed", "repo", ev.Repo, "pr", ev.Number, "count", n)
		return nil
	case "opened", "synchronize", "reopened", "ready_for_review":
		return r.deployFromEvent(ctx, ev)
	default:
		return nil
	}
}

func (r *Reconciler) deployFromEvent(ctx context.Context, ev *gh.PullRequestEvent) error {
	if !gh.AutoBuildAllowed(ev.FromFork, ev.AuthorAssociation) {
		r.logger.Info("fork PR gated; not auto-building", "repo", ev.Repo, "pr", ev.Number, "association", ev.AuthorAssociation)
		return nil
	}
	repoCfg, err := r.gh.RepoConfig(ctx, ev.InstallationID, ev.Owner, ev.Name, ev.HeadSHA)
	if err != nil {
		// A repo without a valid .prevly.yml is simply not onboarded.
		r.logger.Info("skipping PR without usable .prevly.yml", "repo", ev.Repo, "pr", ev.Number, "err", err)
		return nil
	}
	changed, err := r.gh.ChangedFiles(ctx, ev.InstallationID, ev.Owner, ev.Name, ev.Number)
	if err != nil {
		return err
	}
	apps := gh.AppsToDeploy(repoCfg, ev.BaseBranch, ev.HeadBranch, changed)
	if len(apps) == 0 {
		r.logger.Debug("no apps matched", "repo", ev.Repo, "pr", ev.Number)
		return nil
	}
	r.deployApps(ctx, ev, repoCfg, apps)
	return nil
}

func (r *Reconciler) deployApps(ctx context.Context, ev *gh.PullRequestEvent, repoCfg *config.RepoConfig, apps []config.AppConfig) {
	for _, app := range apps {
		if err := r.deployApp(ctx, ev, repoCfg, app); err != nil {
			r.logger.Error("deploy app", "repo", ev.Repo, "pr", ev.Number, "app", app.Name, "err", err)
		}
	}
}

// HandleIssueComment reacts to ChatOps comments. It implements
// github.EventHandler.
func (r *Reconciler) HandleIssueComment(ctx context.Context, ev *gh.IssueCommentEvent) error {
	if !ev.IsPullRequest || ev.Action != "created" {
		return nil
	}
	cmd, ok := gh.ParseCommand(ev.Body)
	if !ok {
		return nil
	}
	if !gh.TrustedAuthor(ev.AuthorAssociation) {
		r.logger.Info("chatops denied for untrusted author", "repo", ev.Repo, "pr", ev.Number, "association", ev.AuthorAssociation)
		return nil
	}

	switch cmd.Action {
	case gh.ActionStatus:
		r.updateComment(ctx, prEventFromComment(ev))
		return nil
	case gh.ActionDestroy:
		n, err := r.teardownPR(ctx, ev.Repo, ev.Number, cmd.App)
		if err != nil {
			return err
		}
		r.logger.Info("chatops destroy", "repo", ev.Repo, "pr", ev.Number, "app", cmd.App, "count", n)
		r.updateComment(ctx, prEventFromComment(ev))
		return nil
	case gh.ActionRedeploy:
		return r.redeploy(ctx, ev, cmd.App)
	default:
		return nil
	}
}

func (r *Reconciler) redeploy(ctx context.Context, ev *gh.IssueCommentEvent, app string) error {
	pr, err := r.gh.PullRequest(ctx, ev.InstallationID, ev.Owner, ev.Name, ev.Number)
	if err != nil {
		return err
	}
	pr.InstallationID = ev.InstallationID
	repoCfg, err := r.gh.RepoConfig(ctx, ev.InstallationID, ev.Owner, ev.Name, pr.HeadSHA)
	if err != nil {
		return err
	}
	// Redeploy forces a rebuild regardless of the path filter.
	apps := repoCfg.Apps
	if app != "" {
		a, ok := repoCfg.App(app)
		if !ok {
			return errors.New("unknown app: " + app)
		}
		apps = []config.AppConfig{a}
	}
	r.deployApps(ctx, pr, repoCfg, apps)
	return nil
}

func prEventFromComment(ev *gh.IssueCommentEvent) *gh.PullRequestEvent {
	return &gh.PullRequestEvent{
		Repo:           ev.Repo,
		Owner:          ev.Owner,
		Name:           ev.Name,
		Number:         ev.Number,
		InstallationID: ev.InstallationID,
	}
}
