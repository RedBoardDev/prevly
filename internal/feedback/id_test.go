package feedback

import (
	"strings"
	"testing"
	"time"
)

func TestNewIDIsTimeOrderedAndUnique(t *testing.T) {
	t.Parallel()
	base := time.Date(2026, 9, 21, 10, 0, 0, 0, time.UTC)
	seen := map[string]bool{}
	var prev string
	for i := range 200 {
		id, err := NewID(base.Add(time.Duration(i) * time.Millisecond))
		if err != nil {
			t.Fatalf("new id: %v", err)
		}
		if len(id) != idLen || !validID(id) {
			t.Fatalf("id %q is not a valid id", id)
		}
		if seen[id] {
			t.Fatalf("duplicate id %q", id)
		}
		seen[id] = true
		if prev != "" && id <= prev {
			t.Fatalf("ids must sort by creation time: %q <= %q", id, prev)
		}
		prev = id
	}
}

func TestNewIDSameMillisecondStaysUnique(t *testing.T) {
	t.Parallel()
	at := time.Date(2026, 9, 21, 10, 0, 0, 0, time.UTC)
	a, err := NewID(at)
	if err != nil {
		t.Fatalf("new id: %v", err)
	}
	b, err := NewID(at)
	if err != nil {
		t.Fatalf("new id: %v", err)
	}
	if a == b {
		t.Fatal("two ids minted in the same millisecond must differ")
	}
	if a[:8] != b[:8] {
		t.Fatalf("timestamp prefix differs for the same instant: %q vs %q", a, b)
	}
}

func TestValidID(t *testing.T) {
	t.Parallel()
	good, err := NewID(time.Now())
	if err != nil {
		t.Fatalf("new id: %v", err)
	}
	bad := []string{
		"", good[:idLen-1], good + "0",
		strings.Repeat("U", idLen),
		strings.Repeat("a", idLen),
		"../../../etc/passwd012345",
		strings.Repeat("0", idLen-2) + "/0",
	}
	if !validID(good) {
		t.Fatalf("%q should be valid", good)
	}
	for _, id := range bad {
		if validID(id) {
			t.Fatalf("%q should be rejected", id)
		}
	}
}
