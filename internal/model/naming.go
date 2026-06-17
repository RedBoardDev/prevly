package model

import (
	"fmt"
	"strings"
)

// sanitize turns an arbitrary identifier into a Docker-safe segment: lowercase
// alphanumerics, dashes and dots; everything else collapses to a dash.
func sanitize(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '.', r == '-':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}
	return strings.Trim(b.String(), "-")
}

func shortSHA(sha string) string {
	if len(sha) > 12 {
		return sha[:12]
	}
	return sha
}

// ImageTag is the local image name for a preview build:
// prevly/<repo>/<app>:pr-<N>-<sha>. The image is never pushed to a registry.
func ImageTag(repo, app string, pr int, sha string) string {
	return fmt.Sprintf("prevly/%s/%s:pr-%d-%s", sanitize(repo), sanitize(app), pr, shortSHA(sha))
}

// ContainerName is the Docker container name for a preview.
func ContainerName(repo string, pr int, app string) string {
	return fmt.Sprintf("prevly-%s-pr%d-%s", sanitize(repo), pr, sanitize(app))
}

// NetworkName is the dedicated per-preview Docker network name.
func NetworkName(repo string, pr int, app string) string {
	return fmt.Sprintf("prevlynet-%s-pr%d-%s", sanitize(repo), pr, sanitize(app))
}

// Managed container labels, used by the reconciler to find and reap orphans.
const (
	LabelManaged = "prevly.managed"
	LabelRepo    = "prevly.repo"
	LabelPR      = "prevly.pr"
	LabelApp     = "prevly.app"
)
