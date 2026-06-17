package github

import (
	"context"
	"fmt"

	gh "github.com/google/go-github/v66/github"
)

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
