package model

import (
	"testing"
	"time"
)

func TestStatusTransitions(t *testing.T) {
	t.Parallel()
	tests := []struct {
		from, to Status
		want     bool
	}{
		{StatusBuilding, StatusRunning, true},
		{StatusBuilding, StatusFailed, true},
		{StatusBuilding, StatusSleeping, false},
		{StatusRunning, StatusSleeping, true},
		{StatusRunning, StatusBuilding, true}, // redeploy
		{StatusRunning, StatusDestroyed, true},
		{StatusSleeping, StatusRunning, true}, // wake
		{StatusSleeping, StatusFailed, false},
		{StatusFailed, StatusBuilding, true}, // retry
		{StatusFailed, StatusRunning, false},
		{StatusDestroyed, StatusBuilding, true}, // reopen
		{StatusDestroyed, StatusRunning, false},
		{StatusRunning, StatusRunning, true}, // idempotent
		{"bogus", StatusRunning, false},
		{StatusRunning, "bogus", false},
	}
	for _, tt := range tests {
		t.Run(string(tt.from)+"->"+string(tt.to), func(t *testing.T) {
			t.Parallel()
			if got := tt.from.CanTransition(tt.to); got != tt.want {
				t.Fatalf("CanTransition(%q->%q) = %v, want %v", tt.from, tt.to, got, tt.want)
			}
		})
	}
}

func TestSetStatus(t *testing.T) {
	t.Parallel()
	p := &Preview{Status: StatusBuilding}
	if err := p.SetStatus(StatusRunning); err != nil {
		t.Fatalf("building->running should succeed: %v", err)
	}
	if p.Status != StatusRunning {
		t.Fatalf("status = %q", p.Status)
	}
	if err := p.SetStatus(StatusSleeping); err != nil {
		t.Fatalf("running->sleeping should succeed: %v", err)
	}
}

func TestSetStatusIllegal(t *testing.T) {
	t.Parallel()
	p := &Preview{Status: StatusSleeping}
	if err := p.SetStatus(StatusFailed); err == nil {
		t.Fatal("sleeping->failed must be rejected")
	}
	if p.Status != StatusSleeping {
		t.Fatalf("status must be unchanged on illegal transition, got %q", p.Status)
	}
}

func TestIdleSince(t *testing.T) {
	t.Parallel()
	now := time.Now()
	running := &Preview{Status: StatusRunning, Idle: time.Hour, LastSeenAt: now.Add(-2 * time.Hour)}
	if !running.IdleSince(now) {
		t.Fatal("should be idle past window")
	}
	fresh := &Preview{Status: StatusRunning, Idle: time.Hour, LastSeenAt: now.Add(-10 * time.Minute)}
	if fresh.IdleSince(now) {
		t.Fatal("should not be idle within window")
	}
	sleeping := &Preview{Status: StatusSleeping, Idle: time.Hour, LastSeenAt: now.Add(-2 * time.Hour)}
	if sleeping.IdleSince(now) {
		t.Fatal("only running previews go idle")
	}
}

func TestExpired(t *testing.T) {
	t.Parallel()
	now := time.Now()
	old := &Preview{Status: StatusSleeping, TTL: 30 * 24 * time.Hour, LastSeenAt: now.Add(-31 * 24 * time.Hour)}
	if !old.Expired(now) {
		t.Fatal("should be expired past TTL")
	}
	recent := &Preview{Status: StatusRunning, TTL: 30 * 24 * time.Hour, LastSeenAt: now.Add(-1 * time.Hour)}
	if recent.Expired(now) {
		t.Fatal("should not be expired within TTL")
	}
	destroyed := &Preview{Status: StatusDestroyed, TTL: time.Hour, LastSeenAt: now.Add(-48 * time.Hour)}
	if destroyed.Expired(now) {
		t.Fatal("destroyed previews are never expired")
	}
}

func TestKey(t *testing.T) {
	t.Parallel()
	p := &Preview{Repo: "org/repo", PRNumber: 42, AppName: "bo"}
	if got := p.Key(); got != "org/repo#42#bo" {
		t.Fatalf("Key() = %q", got)
	}
}
