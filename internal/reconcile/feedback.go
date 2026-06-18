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
			App:        p.AppName,
			Status:     p.Status,
			URL:        liveURL(p),
			LogExcerpt: p.FailureLog,
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
