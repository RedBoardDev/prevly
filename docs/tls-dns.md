# TLS, DNS & subdomains

prevly terminates TLS itself via **CertMagic** (the ACME library from the Caddy
authors), used in-process by the embedded proxy. No external Caddy/Traefik.

## Subdomain scheme

- Multi-app repo: `pr-<N>-<app.subdomain>.<base_domain>`
  (e.g. `pr-42-bo.preview.staging.kare-app.fr`, `pr-42-audit.preview.staging.kare-app.fr`).
- Single-app repo (no `subdomain`): `pr-<N>.<base_domain>`.
- The PR id alone can't disambiguate multiple apps of the same PR → the `-<app>`
  segment is required only in multi-app repos.

## DNS

- **One wildcard record**, set once: `*.<base_domain>` → host public IP
  (A, and AAAA if IPv6). New PRs/apps need **no DNS change**.
- Example (KARE): `*.preview.staging.kare-app.fr → <host IP>` in Route53.

## TLS modes (CertMagic)

- **`dns-01` (recommended, default)**: one **wildcard certificate**
  `*.<base_domain>` via the DNS provider API → every `pr-*` host is covered, no
  per-PR issuance, no ACME on the request hot path. v1 providers: **Route53,
  Cloudflare** (CertMagic supports many more; easy to add). Provider creds come
  from host env (`AWS_*`, `CLOUDFLARE_API_TOKEN`).
- **`on-demand`**: mint a cert per host on first TLS handshake — **zero DNS
  config**. prevly gates issuance with an internal "ask" check against its state
  (only mint for a host that maps to a known preview) to prevent abuse. Trade-off:
  a few seconds added to the *first* request to a brand-new subdomain.

## Why a custom domain (cookies)

Previews under `*.<base_domain>` (a subdomain of your real domain) can share
same-site cookies with a backend on that domain — so **auth works** when the
preview talks to your existing (e.g. staging) API. A foreign tunnel domain
(`*.some-tunnel.dev`) breaks this. That's why custom-domain is the v1 model and
the (future) tunnel mode carries a cookie caveat.

## Ingress interface (future tunnel)

The proxy sits behind an `Ingress` interface (`Publish(host) → reachable URL`).
v1 implementation = **direct** (public host + wildcard DNS + CertMagic). v1.1 can
add a **cloudflared** implementation for hosts without a public IP, without
touching the rest of the daemon.
