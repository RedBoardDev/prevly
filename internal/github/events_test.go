package github

import "testing"

const prPayload = `{
  "action": "opened",
  "number": 42,
  "pull_request": {
    "merged": false,
    "author_association": "MEMBER",
    "base": {"ref": "main", "repo": {"id": 1, "full_name": "org/repo"}},
    "head": {"ref": "feature/login", "sha": "abc123", "repo": {"id": 1, "clone_url": "https://github.com/org/repo.git"}}
  },
  "repository": {"full_name": "org/repo", "name": "repo", "owner": {"login": "org"}},
  "installation": {"id": 555}
}`

const forkPRPayload = `{
  "action": "opened",
  "number": 7,
  "pull_request": {
    "author_association": "CONTRIBUTOR",
    "base": {"ref": "main", "repo": {"id": 1}},
    "head": {"ref": "patch-1", "sha": "def456", "repo": {"id": 999, "clone_url": "https://github.com/fork/repo.git"}}
  },
  "repository": {"full_name": "org/repo", "name": "repo", "owner": {"login": "org"}},
  "installation": {"id": 555}
}`

func TestParsePullRequest(t *testing.T) {
	t.Parallel()
	e, err := ParsePullRequest([]byte(prPayload))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if e.Action != "opened" || e.Number != 42 || e.Repo != "org/repo" {
		t.Fatalf("unexpected event: %+v", e)
	}
	if e.BaseBranch != "main" || e.HeadBranch != "feature/login" || e.HeadSHA != "abc123" {
		t.Fatalf("branch/sha mismatch: %+v", e)
	}
	if e.FromFork {
		t.Fatal("same-repo PR should not be a fork")
	}
	if e.InstallationID != 555 {
		t.Fatalf("installation id = %d", e.InstallationID)
	}
}

func TestParsePullRequestFork(t *testing.T) {
	t.Parallel()
	e, err := ParsePullRequest([]byte(forkPRPayload))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if !e.FromFork {
		t.Fatal("differing head/base repo ids must be detected as a fork")
	}
	if AutoBuildAllowed(e.FromFork, e.AuthorAssociation) {
		t.Fatal("untrusted fork PR must not auto-build")
	}
}

const commentPayload = `{
  "action": "created",
  "issue": {"number": 42, "pull_request": {"url": "https://api.github.com/repos/org/repo/pulls/42"}},
  "comment": {"body": "/preview redeploy bo", "author_association": "OWNER"},
  "repository": {"full_name": "org/repo", "name": "repo", "owner": {"login": "org"}},
  "installation": {"id": 555}
}`

func TestParseIssueComment(t *testing.T) {
	t.Parallel()
	e, err := ParseIssueComment([]byte(commentPayload))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if !e.IsPullRequest {
		t.Fatal("comment should be detected as on a PR")
	}
	if e.Number != 42 || e.Body != "/preview redeploy bo" {
		t.Fatalf("unexpected comment: %+v", e)
	}
	cmd, ok := ParseCommand(e.Body)
	if !ok || cmd.Action != ActionRedeploy || cmd.App != "bo" {
		t.Fatalf("command parse mismatch: %+v ok=%v", cmd, ok)
	}
	if !TrustedAuthor(e.AuthorAssociation) {
		t.Fatal("OWNER should be trusted")
	}
}
