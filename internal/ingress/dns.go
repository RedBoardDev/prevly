package ingress

import (
	"fmt"
	"os"

	"github.com/caddyserver/certmagic"
	"github.com/libdns/cloudflare"
	"github.com/libdns/route53"
)

// dnsProvider builds a CertMagic DNS provider for the configured backend. Both
// providers read their credentials from the host environment, never from config
// files (docs/security.md).
func dnsProvider(name string) (certmagic.DNSProvider, error) {
	switch name {
	case "route53":
		return &route53.Provider{}, nil
	case "cloudflare":
		token := os.Getenv("CLOUDFLARE_API_TOKEN")
		if token == "" {
			return nil, fmt.Errorf("cloudflare provider requires CLOUDFLARE_API_TOKEN")
		}
		return &cloudflare.Provider{APIToken: token}, nil
	default:
		return nil, fmt.Errorf("unsupported dns provider %q (route53|cloudflare)", name)
	}
}
