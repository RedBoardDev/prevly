package secrets

import (
	"strings"
	"testing"
)

func fakeEnv(m map[string]string) Getenv {
	return func(k string) (string, bool) {
		v, ok := m[k]
		return v, ok
	}
}

func TestResolveSuccess(t *testing.T) {
	t.Parallel()
	r := New(
		map[string]string{"SA_KEY": "env:PREVLY_SA", "API": "env:PREVLY_API"},
		fakeEnv(map[string]string{"PREVLY_SA": "s3cr3t", "PREVLY_API": "tok"}),
	)
	got, err := r.Resolve([]string{"SA_KEY", "API"})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if got["SA_KEY"] != "s3cr3t" || got["API"] != "tok" {
		t.Fatalf("unexpected values: %v", got)
	}
}

func TestResolveErrors(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		table map[string]string
		env   map[string]string
		names []string
		msg   string
	}{
		{"undeclared name", map[string]string{}, nil, []string{"X"}, "not declared"},
		{"missing env var", map[string]string{"X": "env:MISSING"}, map[string]string{}, []string{"X"}, "is not set"},
		{"bad reference form", map[string]string{"X": "plainvalue"}, nil, []string{"X"}, "must be of the form"},
		{"unsupported scheme", map[string]string{"X": "vault:secret/x"}, nil, []string{"X"}, "unsupported reference scheme"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			r := New(tt.table, fakeEnv(tt.env))
			_, err := r.Resolve(tt.names)
			if err == nil {
				t.Fatalf("expected error containing %q", tt.msg)
			}
			if !strings.Contains(err.Error(), tt.msg) {
				t.Fatalf("error %q does not contain %q", err.Error(), tt.msg)
			}
		})
	}
}
