package github

import (
	"context"
	"fmt"
	"strings"

	gh "github.com/google/go-github/v66/github"

	"github.com/RedBoardDev/prevly/internal/model"
)

// stickyMarker identifies prevly's single PR comment so it can be updated in
// place instead of posting a new comment on every event.
const stickyMarker = "<!-- prevly -->"

// AppStatus is one app's line in the sticky PR comment.
type AppStatus struct {
	App        string
	Status     model.Status
	URL        string
	LogExcerpt string // shown only on failure
}

// RenderStickyComment renders the single prevly PR comment body. Pure so it can
// be unit-tested.
func RenderStickyComment(apps []AppStatus) string {
	var b strings.Builder
	b.WriteString(stickyMarker + "\n")
	b.WriteString("## prevly previews\n\n")
	b.WriteString("| App | Status | URL |\n|---|---|---|\n")
	for _, a := range apps {
		url := "—"
		if a.URL != "" {
			url = "[open](" + a.URL + ")"
		}
		fmt.Fprintf(&b, "| %s | %s | %s |\n", a.App, statusBadge(a.Status), url)
	}
	for _, a := range apps {
		if a.Status == model.StatusFailed && a.LogExcerpt != "" {
			fmt.Fprintf(&b, "\n<details><summary>%s build log</summary>\n\n```\n%s\n```\n</details>\n", a.App, a.LogExcerpt)
		}
	}
	return b.String()
}

// RenderConfigError renders a sticky comment reporting an invalid .prevly.yml.
func RenderConfigError(err error) string {
	return stickyMarker + "\n## prevly previews\n\n" +
		"⚠️ Could not read `.prevly.yml`:\n\n```\n" + err.Error() + "\n```\n"
}

func statusBadge(s model.Status) string {
	switch s {
	case model.StatusRunning:
		return "🟢 live"
	case model.StatusBuilding:
		return "🟡 building"
	case model.StatusSleeping:
		return "💤 sleeping"
	case model.StatusFailed:
		return "🔴 failed"
	case model.StatusDestroyed:
		return "⚪ destroyed"
	default:
		return string(s)
	}
}

// deploymentState maps a preview status to a GitHub Deployment status state.
func deploymentState(s model.Status) string {
	switch s {
	case model.StatusBuilding:
		return "in_progress"
	case model.StatusRunning, model.StatusSleeping:
		return "success"
	case model.StatusFailed:
		return "failure"
	case model.StatusDestroyed:
		return "inactive"
	default:
		return "error"
	}
}

// Feedback posts PR feedback: the sticky comment and native Deployments.
// Implemented by APIFeedback; an interface so the reconciler can be faked.
type Feedback interface {
	UpsertComment(ctx context.Context, owner, repo string, pr int, body string) (int64, error)
	CreateDeployment(ctx context.Context, owner, repo, ref, environment string) (int64, error)
	SetDeploymentStatus(ctx context.Context, owner, repo string, deploymentID int64, status model.Status, environmentURL string) error
}

// APIFeedback implements Feedback against the GitHub API.
type APIFeedback struct {
	client *gh.Client
}

// NewFeedback wraps an installation-scoped client.
func NewFeedback(client *gh.Client) *APIFeedback { return &APIFeedback{client: client} }

// UpsertComment finds prevly's sticky comment by marker and edits it, creating
// it if absent. Returns the comment id.
func (f *APIFeedback) UpsertComment(ctx context.Context, owner, repo string, pr int, body string) (int64, error) {
	opts := &gh.IssueListCommentsOptions{ListOptions: gh.ListOptions{PerPage: 100}}
	for {
		comments, resp, err := f.client.Issues.ListComments(ctx, owner, repo, pr, opts)
		if err != nil {
			return 0, fmt.Errorf("list comments: %w", err)
		}
		for _, c := range comments {
			if strings.Contains(c.GetBody(), stickyMarker) {
				edited, _, err := f.client.Issues.EditComment(ctx, owner, repo, c.GetID(), &gh.IssueComment{Body: &body})
				if err != nil {
					return 0, fmt.Errorf("edit comment: %w", err)
				}
				return edited.GetID(), nil
			}
		}
		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}
	created, _, err := f.client.Issues.CreateComment(ctx, owner, repo, pr, &gh.IssueComment{Body: &body})
	if err != nil {
		return 0, fmt.Errorf("create comment: %w", err)
	}
	return created.GetID(), nil
}

// CreateDeployment creates a native Deployment for an app's preview.
func (f *APIFeedback) CreateDeployment(ctx context.Context, owner, repo, ref, environment string) (int64, error) {
	autoMerge := false
	transient := true
	req := &gh.DeploymentRequest{
		Ref:                  &ref,
		Environment:          &environment,
		AutoMerge:            &autoMerge,
		RequiredContexts:     &[]string{},
		TransientEnvironment: &transient,
	}
	dep, _, err := f.client.Repositories.CreateDeployment(ctx, owner, repo, req)
	if err != nil {
		return 0, fmt.Errorf("create deployment: %w", err)
	}
	return dep.GetID(), nil
}

// SetDeploymentStatus updates a Deployment's status, attaching the preview URL.
func (f *APIFeedback) SetDeploymentStatus(ctx context.Context, owner, repo string, deploymentID int64, status model.Status, environmentURL string) error {
	state := deploymentState(status)
	req := &gh.DeploymentStatusRequest{State: &state}
	if environmentURL != "" {
		req.EnvironmentURL = &environmentURL
	}
	_, _, err := f.client.Repositories.CreateDeploymentStatus(ctx, owner, repo, deploymentID, req)
	if err != nil {
		return fmt.Errorf("set deployment status: %w", err)
	}
	return nil
}
