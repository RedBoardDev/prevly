// Package secrets resolves secret names referenced in `.prevly.yml` to their
// values. In v1 the only backend is the daemon's process environment: the host
// config maps each secret name to an "env:VARNAME" reference.
package secrets

import (
	"fmt"
	"strings"
)

// Getenv reads an environment variable; injected for testability.
type Getenv func(string) (string, bool)

// Resolver maps secret names to values using the host config's secret table.
type Resolver struct {
	// table maps a logical secret name to a reference like "env:PREVLY_X".
	table  map[string]string
	getenv Getenv
}

// New builds a Resolver from the host config's secrets table.
func New(table map[string]string, getenv Getenv) *Resolver {
	return &Resolver{table: table, getenv: getenv}
}

// Resolve looks up the values for the requested secret names. It fails loudly:
// an unknown name, an unsupported reference, or a missing env var is an error
// (never a silent empty value).
func (r *Resolver) Resolve(names []string) (map[string]string, error) {
	out := make(map[string]string, len(names))
	for _, name := range names {
		ref, ok := r.table[name]
		if !ok {
			return nil, fmt.Errorf("secret %q: not declared in host config secrets table", name)
		}
		val, err := r.resolveRef(name, ref)
		if err != nil {
			return nil, err
		}
		out[name] = val
	}
	return out, nil
}

func (r *Resolver) resolveRef(name, ref string) (string, error) {
	scheme, rest, ok := strings.Cut(ref, ":")
	if !ok {
		return "", fmt.Errorf("secret %q: reference %q must be of the form env:VARNAME", name, ref)
	}
	switch scheme {
	case "env":
		val, present := r.getenv(rest)
		if !present {
			return "", fmt.Errorf("secret %q: env var %q is not set", name, rest)
		}
		return val, nil
	default:
		return "", fmt.Errorf("secret %q: unsupported reference scheme %q (only env: in v1)", name, scheme)
	}
}
