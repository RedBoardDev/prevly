// Package model holds the shared domain types used across prevly: the preview
// record persisted in the store and its lifecycle state machine.
package model

import (
	"fmt"
	"slices"
	"time"
)

// Status is the lifecycle state of a Preview.
type Status string

const (
	// StatusBuilding means an image build / (re)deploy is in progress.
	StatusBuilding Status = "building"
	// StatusRunning means the container is up and serving requests.
	StatusRunning Status = "running"
	// StatusSleeping means the container was stopped after being idle; it can
	// be woken on the next request without a rebuild.
	StatusSleeping Status = "sleeping"
	// StatusFailed means the last build or deploy failed.
	StatusFailed Status = "failed"
	// StatusDestroyed means the preview was torn down (container removed).
	StatusDestroyed Status = "destroyed"
)

// Valid reports whether s is a known status.
func (s Status) Valid() bool {
	switch s {
	case StatusBuilding, StatusRunning, StatusSleeping, StatusFailed, StatusDestroyed:
		return true
	default:
		return false
	}
}

// allowedTransitions encodes the preview state machine from
// docs/lifecycle-and-cli.md. A transition to the same state is always allowed
// (idempotent re-application by the reconciler).
var allowedTransitions = map[Status][]Status{
	StatusBuilding:  {StatusRunning, StatusFailed, StatusDestroyed},
	StatusRunning:   {StatusSleeping, StatusBuilding, StatusFailed, StatusDestroyed},
	StatusSleeping:  {StatusRunning, StatusBuilding, StatusDestroyed},
	StatusFailed:    {StatusBuilding, StatusDestroyed},
	StatusDestroyed: {StatusBuilding},
}

// CanTransition reports whether moving from the current status to "to" is a
// legal lifecycle transition.
func (s Status) CanTransition(to Status) bool {
	if !s.Valid() || !to.Valid() {
		return false
	}
	if s == to {
		return true
	}
	return slices.Contains(allowedTransitions[s], to)
}

// Preview is one running (or sleeping/failed) instance of an app for a PR.
// It is keyed by (repo, pr_number, app_name) and is the source of truth for
// routing, lifecycle and garbage collection.
type Preview struct {
	Repo      string `json:"repo"`      // "owner/name"
	PRNumber  int    `json:"pr_number"` // pull request number
	AppName   string `json:"app_name"`  // app name from .prevly.yml
	Subdomain string `json:"subdomain"` // app subdomain segment (may be empty)
	URL       string `json:"url"`       // full https URL
	Host      string `json:"host"`      // routing host, e.g. pr-42-bo.<base>

	ContainerID string `json:"container_id"`
	ImageTag    string `json:"image_tag"`
	NetworkName string `json:"network_name"`
	CommitSHA   string `json:"commit_sha"`
	Port        int    `json:"port"`

	Status Status `json:"status"`

	CreatedAt  time.Time     `json:"created_at"`
	LastSeenAt time.Time     `json:"last_seen_at"` // last request; drives idle/sleep
	TTL        time.Duration `json:"ttl"`
	Idle       time.Duration `json:"idle"`

	DeploymentID int64 `json:"deployment_id"` // GitHub Deployment id
	CommentID    int64 `json:"comment_id"`    // sticky PR comment id

	FailureLog string `json:"failure_log,omitempty"`
}

// Key returns the stable identity of the preview ("repo/pr/app"), used as the
// store key.
func (p *Preview) Key() string {
	return PreviewKey(p.Repo, p.PRNumber, p.AppName)
}

// PreviewKey builds a store key from its components.
func PreviewKey(repo string, pr int, app string) string {
	return fmt.Sprintf("%s#%d#%s", repo, pr, app)
}

// SetStatus validates and applies a lifecycle transition.
func (p *Preview) SetStatus(to Status) error {
	if !p.Status.CanTransition(to) {
		return fmt.Errorf("illegal preview transition %q -> %q", p.Status, to)
	}
	p.Status = to
	return nil
}

// IdleSince reports whether the preview has been idle (no request) for at least
// its Idle window as of now. Only running previews can go idle.
func (p *Preview) IdleSince(now time.Time) bool {
	if p.Status != StatusRunning || p.Idle <= 0 {
		return false
	}
	return now.Sub(p.LastSeenAt) >= p.Idle
}

// Expired reports whether the preview has exceeded its TTL since last activity.
func (p *Preview) Expired(now time.Time) bool {
	if p.TTL <= 0 || p.Status == StatusDestroyed {
		return false
	}
	return now.Sub(p.LastSeenAt) >= p.TTL
}
