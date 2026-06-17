// Package log provides the daemon's structured logger.
//
// It is a thin wrapper over log/slog so the rest of the codebase depends on a
// stable, minimal surface rather than on slog directly.
package log

import (
	"io"
	"log/slog"
	"os"
	"strings"
)

// Logger is the structured logger used across prevly.
type Logger = slog.Logger

// Options configures the logger.
type Options struct {
	// Level is one of "debug", "info", "warn", "error". Defaults to "info".
	Level string
	// JSON selects JSON output instead of human-readable text.
	JSON bool
	// Out is the destination; defaults to os.Stderr.
	Out io.Writer
}

// New builds a Logger from Options.
func New(opts Options) *Logger {
	out := opts.Out
	if out == nil {
		out = os.Stderr
	}
	h := &slog.HandlerOptions{Level: parseLevel(opts.Level)}
	var handler slog.Handler
	if opts.JSON {
		handler = slog.NewJSONHandler(out, h)
	} else {
		handler = slog.NewTextHandler(out, h)
	}
	return slog.New(handler)
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
