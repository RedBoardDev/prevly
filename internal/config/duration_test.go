package config

import (
	"testing"
	"time"
)

func TestParseDuration(t *testing.T) {
	t.Parallel()
	tests := []struct {
		in      string
		want    time.Duration
		wantErr bool
	}{
		{"30d", 30 * 24 * time.Hour, false},
		{"6h", 6 * time.Hour, false},
		{"90m", 90 * time.Minute, false},
		{"1.5d", 36 * time.Hour, false},
		{"", 0, false},
		{"banana", 0, true},
		{"10x", 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			t.Parallel()
			got, err := ParseDuration(tt.in)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error for %q", tt.in)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("ParseDuration(%q) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestDurationStringRoundTrip(t *testing.T) {
	t.Parallel()
	if got := Duration(30 * day).String(); got != "30d" {
		t.Fatalf("String() = %q, want 30d", got)
	}
	if got := Duration(6 * time.Hour).String(); got != "6h0m0s" {
		t.Fatalf("String() = %q, want 6h0m0s", got)
	}
}
