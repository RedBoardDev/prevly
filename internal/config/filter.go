package config

import (
	"fmt"
	"path"
	"slices"
	"strings"
)

// MatchedApps returns the apps whose path globs intersect the PR's changed
// files. This is the per-app path filter: a PR touching only one app's paths
// deploys only that app.
func (c *RepoConfig) MatchedApps(changedFiles []string) []AppConfig {
	var out []AppConfig
	for _, a := range c.Apps {
		if appMatches(a, changedFiles) {
			out = append(out, a)
		}
	}
	return out
}

func appMatches(a AppConfig, changedFiles []string) bool {
	for _, f := range changedFiles {
		for _, g := range a.Paths {
			if matchGlob(g, f) {
				return true
			}
		}
	}
	return false
}

// matchGlob matches a slash-separated path against a glob, supporting the "**"
// recursive wildcard (any number of segments, including zero) in addition to
// the single-segment wildcards of path.Match ("*", "?", "[...]").
func matchGlob(pattern, name string) bool {
	return matchSegments(strings.Split(pattern, "/"), strings.Split(name, "/"))
}

func matchSegments(pat, name []string) bool {
	for len(pat) > 0 {
		if pat[0] == "**" {
			if len(pat) == 1 {
				return true // trailing "**" matches all remaining segments
			}
			for i := 0; i <= len(name); i++ {
				if matchSegments(pat[1:], name[i:]) {
					return true
				}
			}
			return false
		}
		if len(name) == 0 {
			return false
		}
		if ok, _ := path.Match(pat[0], name[0]); !ok {
			return false
		}
		pat, name = pat[1:], name[1:]
	}
	return len(name) == 0
}

// BranchAllowed reports whether a PR with the given base and head branches is
// eligible for previews under the repo's triggers.
func (c *RepoConfig) BranchAllowed(baseBranch, headBranch string) bool {
	t := c.Triggers
	if len(t.TargetBranches) > 0 && !slices.Contains(t.TargetBranches, baseBranch) {
		return false
	}
	for _, g := range t.ExcludeHeadBranches {
		if matchGlob(g, headBranch) {
			return false
		}
	}
	return true
}

// Host derives the routing host for a preview of app within a PR, given the
// daemon's base domain. With a subdomain: pr-<N>-<sub>.<base>; without one
// (single-app repo): pr-<N>.<base>.
func (c *RepoConfig) Host(baseDomain string, pr int, app AppConfig) string {
	if app.Subdomain == "" {
		return fmt.Sprintf("pr-%d.%s", pr, baseDomain)
	}
	return fmt.Sprintf("pr-%d-%s.%s", pr, app.Subdomain, baseDomain)
}
