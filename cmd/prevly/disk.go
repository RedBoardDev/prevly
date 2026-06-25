package main

import (
	"fmt"

	"golang.org/x/sys/unix"
)

// Disk-space thresholds for `prevly doctor`. The data dir filesystem holds the
// bbolt store, container images and build context; running it to 0% wedges the
// daemon (the very incident this check exists to catch early).
const (
	// diskCriticalFreeRatio fails the check when free space drops below this
	// fraction of capacity.
	diskCriticalFreeRatio = 0.05 // 5%
	// diskCriticalFreeBytes fails the check when fewer than this many bytes are
	// free, regardless of ratio (large disks can be dangerously low at 5%).
	diskCriticalFreeBytes = 2 << 30 // 2 GiB
	// diskLowFreeRatio warns when free space drops below this fraction.
	diskLowFreeRatio = 0.15 // 15%
)

// diskStat is the subset of filesystem stats the disk check needs. Splitting it
// out keeps the threshold logic testable without a real syscall.
type diskStat struct {
	totalBytes uint64
	freeBytes  uint64 // space available to an unprivileged process
}

// diskUsage reports free-space stats for the filesystem backing dir.
func diskUsage(dir string) (diskStat, error) {
	var st unix.Statfs_t
	if err := unix.Statfs(dir, &st); err != nil {
		return diskStat{}, fmt.Errorf("statfs %q: %w", dir, err)
	}
	bsize := uint64(st.Bsize) //nolint:unconvert // Bsize is int64 on Linux, uint32 on darwin
	return diskStat{
		totalBytes: st.Blocks * bsize,
		freeBytes:  st.Bavail * bsize,
	}, nil
}

// freeRatio is the fraction of capacity still free (0..1).
func (d diskStat) freeRatio() float64 {
	if d.totalBytes == 0 {
		return 0
	}
	return float64(d.freeBytes) / float64(d.totalBytes)
}

// usedPercent is the fraction of capacity in use, as a percentage.
func (d diskStat) usedPercent() float64 {
	return (1 - d.freeRatio()) * 100
}

// critical reports whether free space is dangerously low: a FAIL.
func (d diskStat) critical() bool {
	return d.freeRatio() < diskCriticalFreeRatio || d.freeBytes < diskCriticalFreeBytes
}

// low reports whether free space is getting low: a WARN. critical() implies
// low(), so callers must test critical() first.
func (d diskStat) low() bool {
	return d.freeRatio() < diskLowFreeRatio
}

// String renders the usage for human-readable output.
func (d diskStat) String() string {
	return fmt.Sprintf("%.0f%% used, %s free of %s",
		d.usedPercent(), humanBytes(d.freeBytes), humanBytes(d.totalBytes))
}

func humanBytes(b uint64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%dB", b)
	}
	div, exp := uint64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f%ciB", float64(b)/float64(div), "KMGTPE"[exp])
}
