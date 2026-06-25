package main

import (
	"testing"
)

func TestDiskStatThresholds(t *testing.T) {
	t.Parallel()
	const tb = 100 << 30 // 100 GiB capacity for ratio-driven cases

	tests := []struct {
		name         string
		stat         diskStat
		wantCritical bool
		wantLow      bool
	}{
		{
			// The production incident: disk effectively full must FAIL, not pass.
			name:         "full disk fails",
			stat:         diskStat{totalBytes: tb, freeBytes: 0},
			wantCritical: true,
			wantLow:      true,
		},
		{
			name:         "below 5% ratio fails",
			stat:         diskStat{totalBytes: tb, freeBytes: tb * 4 / 100}, // 4% free
			wantCritical: true,
			wantLow:      true,
		},
		{
			// Big disk at 8% free passes the ratio but trips the absolute-bytes
			// floor — must still FAIL.
			name:         "large disk low absolute bytes fails",
			stat:         diskStat{totalBytes: 1 << 40, freeBytes: 1 << 30}, // 1 TiB, 1 GiB free (~0.1%)
			wantCritical: true,
			wantLow:      true,
		},
		{
			name:         "below 15% but above 5% warns only",
			stat:         diskStat{totalBytes: tb, freeBytes: tb * 10 / 100}, // 10% free
			wantCritical: false,
			wantLow:      true,
		},
		{
			name:         "plenty free is healthy",
			stat:         diskStat{totalBytes: tb, freeBytes: tb * 50 / 100}, // 50% free
			wantCritical: false,
			wantLow:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := tt.stat.critical(); got != tt.wantCritical {
				t.Errorf("critical() = %v, want %v (%s)", got, tt.wantCritical, tt.stat)
			}
			if got := tt.stat.low(); got != tt.wantLow {
				t.Errorf("low() = %v, want %v (%s)", got, tt.wantLow, tt.stat)
			}
			// critical must imply low so the doctor's ordered switch never
			// mislabels a FAIL as a WARN.
			if tt.stat.critical() && !tt.stat.low() {
				t.Errorf("critical() true but low() false — switch ordering would misreport (%s)", tt.stat)
			}
		})
	}
}

func TestDiskUsageReadsRealFilesystem(t *testing.T) {
	t.Parallel()
	got, err := diskUsage(t.TempDir())
	if err != nil {
		t.Fatalf("diskUsage: %v", err)
	}
	if got.totalBytes == 0 {
		t.Fatalf("expected non-zero capacity, got %+v", got)
	}
	if got.freeBytes > got.totalBytes {
		t.Fatalf("free (%d) exceeds total (%d)", got.freeBytes, got.totalBytes)
	}
}

func TestHumanBytes(t *testing.T) {
	t.Parallel()
	tests := map[uint64]string{
		0:           "0B",
		512:         "512B",
		1024:        "1.0KiB",
		1536:        "1.5KiB",
		1 << 20:     "1.0MiB",
		1 << 30:     "1.0GiB",
		5 * 1 << 30: "5.0GiB",
	}
	for in, want := range tests {
		if got := humanBytes(in); got != want {
			t.Errorf("humanBytes(%d) = %q, want %q", in, got, want)
		}
	}
}
