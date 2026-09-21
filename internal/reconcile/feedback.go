package reconcile

import (
	"context"
	"fmt"
	"strings"

	gh "github.com/RedBoardDev/prevly/internal/github"
	"github.com/RedBoardDev/prevly/internal/model"
)

// publishPreview reflects a preview's state to GitHub from the reconcile loop
// (sleep, wake, TTL) where there is no webhook event: it reconstructs the
// minimal context from the stored preview. No-op if the installation is unknown.
func (r *Reconciler) publishPreview(ctx context.Context, p *model.Preview) {
	if p.InstallationID == 0 {
		return
	}
	owner, name, ok := strings.Cut(p.Repo, "/")
	if !ok {
		return
	}
	r.publish(ctx, &gh.PullRequestEvent{
		Repo:           p.Repo,
		Owner:          owner,
		Name:           name,
		Number:         p.PRNumber,
		InstallationID: p.InstallationID,
	}, p)
}

// publish reflects a preview's current state to GitHub: it advances the per-app
// Deployment and refreshes the PR's sticky comment. Feedback failures are
// logged but never abort a deploy.
func (r *Reconciler) publish(ctx context.Context, ev *gh.PullRequestEvent, p *model.Preview) {
	if ev.InstallationID != 0 {
		r.publishDeployment(ctx, ev, p)
	}
	r.updateComment(ctx, ev)
}

func (r *Reconciler) publishDeployment(ctx context.Context, ev *gh.PullRequestEvent, p *model.Preview) {
	if p.DeploymentID == 0 {
		env := deploymentEnv(p)
		id, err := r.gh.CreateDeployment(ctx, ev.InstallationID, ev.Owner, ev.Name, ev.HeadSHA, env)
		if err != nil {
			r.logger.Warn("create deployment", "repo", ev.Repo, "app", p.AppName, "err", err)
			return
		}
		p.DeploymentID = id
		_ = r.store.Put(p)
	}
	if err := r.gh.SetDeploymentStatus(ctx, ev.InstallationID, ev.Owner, ev.Name, p.DeploymentID, p.Status, liveURL(p)); err != nil {
		r.logger.Warn("set deployment status", "repo", ev.Repo, "app", p.AppName, "err", err)
	}
}

func (r *Reconciler) updateComment(ctx context.Context, ev *gh.PullRequestEvent) {
	if ev.InstallationID == 0 {
		return
	}
	previews, err := r.store.ListByPR(ev.Repo, ev.Number)
	if err != nil {
		r.logger.Warn("list previews for comment", "err", err)
		return
	}
	statuses := make([]gh.AppStatus, 0, len(previews))
	for _, p := range previews {
		statuses = append(statuses, gh.AppStatus{
			App:         p.AppName,
			Status:      p.Status,
			URL:         liveURL(p),
			FeedbackURL: r.feedbackURL(p),
			LogExcerpt:  p.FailureLog,
		})
	}
	body := gh.RenderStickyComment(statuses)
	if _, err := r.gh.UpsertComment(ctx, ev.InstallationID, ev.Owner, ev.Name, ev.Number, body); err != nil {
		r.logger.Warn("upsert sticky comment", "repo", ev.Repo, "pr", ev.Number, "err", err)
	}
}

// surfaceConfigError posts the validation error as the PR sticky comment so the
// author sees exactly what is wrong with their .prevly.yml.
func (r *Reconciler) surfaceConfigError(ctx context.Context, ev *gh.PullRequestEvent, cfgErr error) {
	if ev.InstallationID == 0 {
		return
	}
	body := gh.RenderConfigError(cfgErr)
	if _, err := r.gh.UpsertComment(ctx, ev.InstallationID, ev.Owner, ev.Name, ev.Number, body); err != nil {
		r.logger.Warn("surface config error comment", "repo", ev.Repo, "pr", ev.Number, "err", err)
	}
}

func deploymentEnv(p *model.Preview) string {
	return fmt.Sprintf("preview/pr-%d-%s", p.PRNumber, p.AppName)
}

// liveURL returns the preview URL only when it is reachable.
func liveURL(p *model.Preview) string {
	if p.Status == model.StatusRunning || p.Status == model.StatusSleeping {
		return p.URL
	}
	return ""
}

// feedbackURL returns the widget activation link for a live preview, or "" when
// feedback is off on the host or in the repo.
func (r *Reconciler) feedbackURL(p *model.Preview) string {
	if !r.cfg.Feedback.On() || !p.FeedbackOn() {
		return ""
	}
	url := liveURL(p)
	if url == "" {
		return ""
	}
	return url + "/_prevly/activate"
}

// surfaceCapacityError tells the PR that the host has no preview slot left,
// instead of leaving the author with a silent absence of preview.
func (r *Reconciler) surfaceCapacityError(ctx context.Context, ev *gh.PullRequestEvent) {
	if ev.InstallationID == 0 {
		return
	}
	body := gh.RenderCapacityError(r.cfg.Limits.MaxConcurrentPreviews)
	if _, err := r.gh.UpsertComment(ctx, ev.InstallationID, ev.Owner, ev.Name, ev.Number, body); err != nil {
		r.logger.Warn("surface capacity comment", "repo", ev.Repo, "pr", ev.Number, "err", err)
	}
}

// previewEnvironments snapshots the Deployment environment names of a PR's
// previews. Call it before the teardown: teardownPreview deletes the store
// records these names are derived from.
func (r *Reconciler) previewEnvironments(repo string, pr int) []string {
	previews, err := r.store.ListByPR(repo, pr)
	if err != nil {
		r.logger.Warn("list previews for environment cleanup", "repo", repo, "pr", pr, "err", err)
		return nil
	}
	envs := make([]string, 0, len(previews))
	for _, p := range previews {
		envs = append(envs, deploymentEnv(p))
	}
	return envs
}

// deleteEnvironments reclaims the per-PR Deployment environments GitHub creates
// on the first deploy. Nothing else ever removes them: a transient environment
// outlives its deployments, so without this a repo accumulates one environment
// per app per PR for its whole life.
func (r *Reconciler) deleteEnvironments(ctx context.Context, ev *gh.PullRequestEvent, envs []string) {
	if ev.InstallationID == 0 {
		return
	}
	for _, env := range envs {
		if err := r.gh.DeleteEnvironment(ctx, ev.InstallationID, ev.Owner, ev.Name, env); err != nil {
			r.logger.Warn("delete deployment environment", "repo", ev.Repo, "pr", ev.Number, "env", env, "err", err)
		}
	}
}
