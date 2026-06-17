// Package ingress is the embedded reverse proxy and ACME/TLS layer that makes
// prevly a single binary: it routes each preview host to its container and
// terminates TLS via CertMagic (DNS-01 wildcard or on-demand). The Ingress
// interface leaves room for a future tunnel backend without touching callers.
package ingress

import "context"

// Target is the upstream a request host resolves to.
type Target struct {
	Upstream string // host:port reachable by the daemon (e.g. 127.0.0.1:40123)
}

// Resolver maps a request host to its preview upstream. Implemented by the
// reconciler, which also performs wake-on-request for sleeping previews.
type Resolver interface {
	// Resolve returns the upstream for host, waking a sleeping preview if
	// needed. ok is false when no preview is mapped to host.
	Resolve(ctx context.Context, host string) (Target, bool, error)
	// Known reports, without side effects, whether host maps to a preview.
	// Used to gate on-demand TLS issuance against abuse.
	Known(host string) bool
}

// Ingress publishes preview hosts and serves their traffic. v1 has a single
// direct implementation (public host + wildcard DNS + CertMagic).
type Ingress interface {
	// Publish returns the externally reachable URL for a host.
	Publish(host string) string
	// Run serves until ctx is cancelled.
	Run(ctx context.Context) error
}
