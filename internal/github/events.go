package github

import (
	"encoding/json"
	"fmt"

	gh "github.com/google/go-github/v66/github"
)

// PullRequestEvent is the prevly-relevant subset of a GitHub pull_request webhook.
type PullRequestEvent struct {
	Action            string // opened | synchronize | reopened | closed | ready_for_review
	Repo              string // "owner/name"
	Owner             string
	Name              string
	Number            int
	BaseBranch        string
	HeadBranch        string
	HeadSHA           string
	CloneURL          string // https clone URL of the head repo
	Merged            bool
	FromFork          bool
	AuthorAssociation string
	InstallationID    int64
}

// IssueCommentEvent is the prevly-relevant subset of an issue_comment webhook.
// prevly only acts on comments made on pull requests.
type IssueCommentEvent struct {
	Action            string // created | edited | deleted
	Repo              string
	Owner             string
	Name              string
	Number            int // PR number (issues and PRs share numbering)
	Body              string
	AuthorAssociation string
	IsPullRequest     bool
	InstallationID    int64
}

// ParsePullRequest decodes a pull_request webhook payload.
func ParsePullRequest(payload []byte) (*PullRequestEvent, error) {
	var e gh.PullRequestEvent
	if err := unmarshalEvent(payload, &e); err != nil {
		return nil, err
	}
	pr := e.GetPullRequest()
	repo := e.GetRepo()
	out := &PullRequestEvent{
		Action:            e.GetAction(),
		Repo:              repo.GetFullName(),
		Owner:             repo.GetOwner().GetLogin(),
		Name:              repo.GetName(),
		Number:            e.GetNumber(),
		BaseBranch:        pr.GetBase().GetRef(),
		HeadBranch:        pr.GetHead().GetRef(),
		HeadSHA:           pr.GetHead().GetSHA(),
		CloneURL:          pr.GetHead().GetRepo().GetCloneURL(),
		Merged:            pr.GetMerged(),
		AuthorAssociation: pr.GetAuthorAssociation(),
		InstallationID:    e.GetInstallation().GetID(),
	}
	// A PR is from a fork when head and base repos differ.
	out.FromFork = pr.GetHead().GetRepo().GetID() != pr.GetBase().GetRepo().GetID()
	return out, nil
}

// ParseIssueComment decodes an issue_comment webhook payload.
func ParseIssueComment(payload []byte) (*IssueCommentEvent, error) {
	var e gh.IssueCommentEvent
	if err := unmarshalEvent(payload, &e); err != nil {
		return nil, err
	}
	issue := e.GetIssue()
	repo := e.GetRepo()
	return &IssueCommentEvent{
		Action:            e.GetAction(),
		Repo:              repo.GetFullName(),
		Owner:             repo.GetOwner().GetLogin(),
		Name:              repo.GetName(),
		Number:            issue.GetNumber(),
		Body:              e.GetComment().GetBody(),
		AuthorAssociation: e.GetComment().GetAuthorAssociation(),
		IsPullRequest:     issue.IsPullRequest(),
		InstallationID:    e.GetInstallation().GetID(),
	}, nil
}

func unmarshalEvent(payload []byte, v any) error {
	if err := json.Unmarshal(payload, v); err != nil {
		return fmt.Errorf("parse webhook payload: %w", err)
	}
	return nil
}
