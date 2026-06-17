package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	gh "github.com/google/go-github/v66/github"
)

// ErrFileNotFound is returned by FetchFile when the path does not exist (HTTP
// 404), letting callers distinguish "repo not onboarded" from a real error.
var ErrFileNotFound = errors.New("file not found")

// GetPullRequest fetches a PR and maps it to the same shape as a webhook event,
// so ChatOps redeploys can reuse the deploy pipeline.
func GetPullRequest(ctx context.Context, client *gh.Client, owner, name string, number int) (*PullRequestEvent, error) {
	pr, _, err := client.PullRequests.Get(ctx, owner, name, number)
	if err != nil {
		return nil, fmt.Errorf("get pull request: %w", err)
	}
	out := &PullRequestEvent{
		Repo:              owner + "/" + name,
		Owner:             owner,
		Name:              name,
		Number:            number,
		BaseBranch:        pr.GetBase().GetRef(),
		HeadBranch:        pr.GetHead().GetRef(),
		HeadSHA:           pr.GetHead().GetSHA(),
		CloneURL:          pr.GetHead().GetRepo().GetCloneURL(),
		Merged:            pr.GetMerged(),
		AuthorAssociation: pr.GetAuthorAssociation(),
	}
	out.FromFork = pr.GetHead().GetRepo().GetID() != pr.GetBase().GetRepo().GetID()
	return out, nil
}

// FetchFile returns the contents of a file at a given ref (e.g. the PR head
// SHA). Used to read `.prevly.yml` from the PR being previewed.
func FetchFile(ctx context.Context, client *gh.Client, owner, name, path, ref string) ([]byte, error) {
	content, _, _, err := client.Repositories.GetContents(ctx, owner, name, path, &gh.RepositoryContentGetOptions{Ref: ref})
	if err != nil {
		var ge *gh.ErrorResponse
		if errors.As(err, &ge) && ge.Response != nil && ge.Response.StatusCode == http.StatusNotFound {
			return nil, ErrFileNotFound
		}
		return nil, fmt.Errorf("get %s@%s: %w", path, ref, err)
	}
	if content == nil {
		return nil, fmt.Errorf("%s is not a file", path)
	}
	decoded, err := content.GetContent()
	if err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	return []byte(decoded), nil
}

// ListChangedFiles returns every file path changed in a pull request, paging
// through the API. The result feeds the per-app path filter.
func ListChangedFiles(ctx context.Context, client *gh.Client, owner, name string, number int) ([]string, error) {
	opts := &gh.ListOptions{PerPage: 100}
	var files []string
	for {
		page, resp, err := client.PullRequests.ListFiles(ctx, owner, name, number, opts)
		if err != nil {
			return nil, fmt.Errorf("list changed files: %w", err)
		}
		for _, f := range page {
			files = append(files, f.GetFilename())
		}
		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}
	return files, nil
}
