package github

import (
	"strings"

	"github.com/RedBoardDev/prevly/internal/config"
)

// ChatOps actions.
const (
	ActionRedeploy = "redeploy"
	ActionDestroy  = "destroy"
	ActionStatus   = "status"
	ActionWake     = "wake"
	ActionHelp     = "help"
)

// Command is a parsed `/preview ...` ChatOps instruction.
type Command struct {
	Action string // redeploy | destroy | status
	App    string // optional app name; empty means all apps
}

// ParseCommand extracts a `/preview <action> [app]` command from a comment body.
// It scans each line so the command can appear anywhere in the comment. Returns
// ok=false when no recognized command is present.
func ParseCommand(body string) (Command, bool) {
	for line := range strings.SplitSeq(body, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) == 0 || fields[0] != "/preview" {
			continue
		}
		// Bare "/preview" prints the available commands, like a not-found help.
		if len(fields) == 1 {
			return Command{Action: ActionHelp}, true
		}
		action := strings.ToLower(fields[1])
		switch action {
		case ActionRedeploy, ActionDestroy, ActionStatus, ActionWake, ActionHelp:
		default:
			// Unknown subcommand: show help rather than silently ignoring.
			return Command{Action: ActionHelp}, true
		}
		cmd := Command{Action: action}
		if len(fields) >= 3 {
			cmd.App = fields[2]
		}
		return cmd, true
	}
	return Command{}, false
}

// HelpText lists the available ChatOps commands. It is posted as a plain reply
// (no sticky marker) so it never overwrites the status comment.
func HelpText() string {
	return "**prevly commands**\n\n" +
		"| Command | Action |\n|---|---|\n" +
		"| `/preview status` | Show this PR's previews and URLs |\n" +
		"| `/preview redeploy [app]` | Rebuild and redeploy (all apps, or one) |\n" +
		"| `/preview wake [app]` | Wake a sleeping preview (recreates it if needed) |\n" +
		"| `/preview destroy [app]` | Tear down previews (all, or one) |\n" +
		"| `/preview help` | Show this list |\n"
}

// Trusted author associations: members of the repo/org that may run ChatOps and
// whose PRs (even from a fork) may auto-build.
var trustedAssociations = map[string]bool{
	"OWNER":        true,
	"MEMBER":       true,
	"COLLABORATOR": true,
}

// TrustedAuthor reports whether an author association is allowed to run
// privileged actions (ChatOps, approving a fork build).
func TrustedAuthor(association string) bool {
	return trustedAssociations[strings.ToUpper(association)]
}

// AutoBuildAllowed implements fork-PR gating: same-repo PRs build automatically;
// fork PRs only build when opened by a trusted author (maintainer). Untrusted
// fork code never runs automatically.
func AutoBuildAllowed(fromFork bool, association string) bool {
	if !fromFork {
		return true
	}
	return TrustedAuthor(association)
}

// AppsToDeploy applies the branch filter then the per-app path filter to decide
// which apps a PR should (re)deploy. It does not apply fork gating — callers
// combine it with AutoBuildAllowed.
func AppsToDeploy(cfg *config.RepoConfig, baseBranch, headBranch string, changedFiles []string) []config.AppConfig {
	if !cfg.BranchAllowed(baseBranch, headBranch) {
		return nil
	}
	return cfg.MatchedApps(changedFiles)
}
