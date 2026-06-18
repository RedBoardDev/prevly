package builder

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"
)

// CheckoutOptions describes a PR-head checkout.
type CheckoutOptions struct {
	CloneURL string // https clone URL
	SHA      string // exact commit to check out
	Token    string // installation token (used as HTTP basic auth)
	Dir      string // destination directory (created)
}

// Checkout clones the repository and checks out the exact PR-head commit into
// Dir. The installation token authenticates over HTTPS; it is short-lived and
// never logged.
func (b *DockerBuilder) Checkout(ctx context.Context, opts CheckoutOptions) error {
	authURL, err := authenticatedURL(opts.CloneURL, opts.Token)
	if err != nil {
		return err
	}
	// A redeploy (PR synchronize) reuses the same dir; start from a clean tree so
	// `git init` / `remote add` are deterministic instead of failing on an
	// existing repo.
	if err := os.RemoveAll(opts.Dir); err != nil {
		return fmt.Errorf("clean checkout dir: %w", err)
	}
	if err := os.MkdirAll(opts.Dir, 0o700); err != nil {
		return fmt.Errorf("create checkout dir: %w", err)
	}
	steps := [][]string{
		{"-C", opts.Dir, "init", "-q"},
		{"-C", opts.Dir, "remote", "add", "origin", authURL},
		{"-C", opts.Dir, "fetch", "-q", "--depth", "1", "origin", opts.SHA},
		{"-C", opts.Dir, "checkout", "-q", "FETCH_HEAD"},
	}
	for _, args := range steps {
		if out, err := b.r.run(ctx, os.Environ(), "git", args...); err != nil {
			// Avoid leaking the token: report the failing subcommand, not the URL.
			return fmt.Errorf("git %s failed: %w: %s", args[2], err, redact(out, opts.Token))
		}
	}
	return nil
}

// authenticatedURL embeds the installation token as basic-auth credentials in
// the clone URL (GitHub accepts x-access-token:<token>).
func authenticatedURL(cloneURL, token string) (string, error) {
	u, err := url.Parse(cloneURL)
	if err != nil {
		return "", fmt.Errorf("parse clone url: %w", err)
	}
	if u.Scheme != "https" {
		return "", fmt.Errorf("clone url must be https, got %q", u.Scheme)
	}
	u.User = url.UserPassword("x-access-token", token)
	return u.String(), nil
}

func redact(s, secret string) string {
	if secret == "" {
		return s
	}
	return strings.ReplaceAll(s, secret, "***")
}
