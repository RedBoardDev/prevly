package builder

import (
	"strings"
	"testing"
)

func TestAuthenticatedURL(t *testing.T) {
	t.Parallel()
	got, err := authenticatedURL("https://github.com/org/repo.git", "tok123")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got != "https://x-access-token:tok123@github.com/org/repo.git" {
		t.Fatalf("authenticated url = %q", got)
	}

	if _, err := authenticatedURL("git://github.com/org/repo.git", "t"); err == nil {
		t.Fatal("non-https clone url must be rejected")
	}
}

func TestRedact(t *testing.T) {
	t.Parallel()
	in := "fatal: could not read https://x-access-token:tok123@github.com/x"
	out := redact(in, "tok123")
	if strings.Contains(out, "tok123") {
		t.Fatalf("token leaked: %q", out)
	}
	if !strings.Contains(out, "***") {
		t.Fatalf("expected redaction marker: %q", out)
	}
}
