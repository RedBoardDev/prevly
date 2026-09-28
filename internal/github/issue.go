package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	gh "github.com/google/go-github/v66/github"
)

// SiteReport is what CreateSiteIssue needs to turn a site's feedback report
// into a GitHub issue.
type SiteReport struct {
	Title  string
	Body   string // already carries the idempotency marker
	Labels []string
	Type   string // GitHub issue type name; empty when the site has none configured
}

// CreateIssueResult reports what actually landed, so the caller can log a
// dropped label or type against the likely missing App permission.
type CreateIssueResult struct {
	Number             int
	URL                string
	Reused             bool
	RetriedWithoutType bool
	MissingLabels      []string
	TypeDropped        bool
}

// createIssueRequest is a hand-rolled request body: go-github's IssueRequest
// predates the "type" field, and issuing the raw call keeps this on the
// client's existing auth/rate-limit/error plumbing instead of a bare
// http.Client.
type createIssueRequest struct {
	Title  string   `json:"title"`
	Body   string   `json:"body"`
	Labels []string `json:"labels,omitempty"`
	Type   string   `json:"type,omitempty"`
}

type issueTypeField struct {
	Name string `json:"name"`
}

type createdIssue struct {
	Number  int             `json:"number"`
	HTMLURL string          `json:"html_url"`
	Labels  []gh.Label      `json:"labels"`
	Type    *issueTypeField `json:"type"`
}

// CreateSiteIssue creates the GitHub issue for a site report, or reuses one an
// earlier, interrupted attempt already created: it first looks for marker in
// the strongly-consistent issue list, never the search API, whose index lags
// too far behind a retry that follows a timeout by mere seconds.
func CreateSiteIssue(ctx context.Context, client *gh.Client, owner, repo, marker string, since time.Time, r SiteReport) (CreateIssueResult, error) {
	number, url, found, err := findByMarker(ctx, client, owner, repo, marker, since)
	if err != nil {
		return CreateIssueResult{}, err
	}
	if found {
		return CreateIssueResult{Number: number, URL: url, Reused: true}, nil
	}

	created, err := doCreateIssue(ctx, client, owner, repo, r)
	retried := false
	if err != nil && r.Type != "" && retryableWithoutType(err) {
		retried = true
		r.Type = ""
		created, err = doCreateIssue(ctx, client, owner, repo, r)
	}
	if err != nil {
		return CreateIssueResult{}, err
	}

	return CreateIssueResult{
		Number:             created.Number,
		URL:                created.HTMLURL,
		RetriedWithoutType: retried,
		MissingLabels:      missingLabels(r.Labels, created.Labels),
		TypeDropped:        r.Type != "" && (created.Type == nil || !strings.EqualFold(created.Type.Name, r.Type)),
	}, nil
}

func findByMarker(ctx context.Context, client *gh.Client, owner, repo, marker string, since time.Time) (number int, url string, found bool, err error) {
	opts := &gh.IssueListByRepoOptions{
		State:       "all",
		Sort:        "created",
		Direction:   "desc",
		Since:       since,
		ListOptions: gh.ListOptions{PerPage: 100},
	}
	for page := 0; page < 3; page++ {
		issues, resp, err := client.Issues.ListByRepo(ctx, owner, repo, opts)
		if err != nil {
			return 0, "", false, fmt.Errorf("list issues: %w", err)
		}
		for _, iss := range issues {
			if strings.Contains(iss.GetBody(), marker) {
				return iss.GetNumber(), iss.GetHTMLURL(), true, nil
			}
		}
		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}
	return 0, "", false, nil
}

func doCreateIssue(ctx context.Context, client *gh.Client, owner, repo string, r SiteReport) (*createdIssue, error) {
	body := createIssueRequest{Title: r.Title, Body: r.Body, Labels: r.Labels, Type: r.Type}
	req, err := client.NewRequest(http.MethodPost, fmt.Sprintf("repos/%s/%s/issues", owner, repo), body)
	if err != nil {
		return nil, fmt.Errorf("build create issue request: %w", err)
	}
	var out createdIssue
	if _, err := client.Do(ctx, req, &out); err != nil {
		return nil, fmt.Errorf("create issue: %w", err)
	}
	return &out, nil
}

// retryableWithoutType reports whether the API rejected the request in a way
// consistent with the issue type field being the problem (400/422), as
// opposed to an auth or rate-limit failure (401/403/404/429) a retry cannot fix.
func retryableWithoutType(err error) bool {
	var ge *gh.ErrorResponse
	if !errors.As(err, &ge) || ge.Response == nil {
		return false
	}
	switch ge.Response.StatusCode {
	case http.StatusBadRequest, http.StatusUnprocessableEntity:
		return true
	default:
		return false
	}
}

func missingLabels(want []string, got []gh.Label) []string {
	have := make(map[string]bool, len(got))
	for _, l := range got {
		have[l.GetName()] = true
	}
	var missing []string
	for _, w := range want {
		if !have[w] {
			missing = append(missing, w)
		}
	}
	return missing
}
