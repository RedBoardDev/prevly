package config

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Duration is a time.Duration that also understands a trailing "d" (days) unit
// in YAML, e.g. "30d", "6h", "90m". Plain time.Duration syntax is supported too.
type Duration time.Duration

const day = 24 * time.Hour

// UnmarshalYAML implements yaml.Unmarshaler.
func (d *Duration) UnmarshalYAML(unmarshal func(any) error) error {
	var s string
	if err := unmarshal(&s); err != nil {
		return err
	}
	parsed, err := ParseDuration(s)
	if err != nil {
		return err
	}
	*d = Duration(parsed)
	return nil
}

// MarshalYAML implements yaml.Marshaler.
func (d Duration) MarshalYAML() (any, error) {
	return d.String(), nil
}

// Std returns the value as a standard time.Duration.
func (d Duration) Std() time.Duration { return time.Duration(d) }

// String renders the duration, preferring whole-day form when applicable.
func (d Duration) String() string {
	td := time.Duration(d)
	if td != 0 && td%day == 0 {
		return strconv.FormatInt(int64(td/day), 10) + "d"
	}
	return td.String()
}

// ParseDuration parses a duration string supporting a "d" (day) suffix in
// addition to Go's standard units.
func ParseDuration(s string) (time.Duration, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, nil
	}
	if rest, ok := strings.CutSuffix(s, "d"); ok {
		n, err := strconv.ParseFloat(rest, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid duration %q: %w", s, err)
		}
		return time.Duration(n * float64(day)), nil
	}
	td, err := time.ParseDuration(s)
	if err != nil {
		return 0, fmt.Errorf("invalid duration %q: %w", s, err)
	}
	return td, nil
}
