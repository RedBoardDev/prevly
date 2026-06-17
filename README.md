# prevly

**Per-PR preview environments for frontend projects — self-hosted, one binary, no Kubernetes, no cloud lock-in.**

Install prevly's GitHub App on a repo, drop a `.prevly.yml`, and every pull
request gets a live preview URL of the frontend(s) built from that PR —
redeployed on each commit, torn down when the PR closes. Think "AWS Amplify
previews", but open-source and running on **your own Docker host, under your own
domain**.

> **Status: v1 implemented.** The daemon (webhook → build → run → proxy →
> PR feedback → lifecycle) is built and unit-tested. See
> [`DEVELOPMENT.md`](./DEVELOPMENT.md) to build, test and run it, and
> [`docs/`](./docs) for the design. The build order is in
> [`docs/implementation-plan.md`](./docs/implementation-plan.md).

## Why

For "I just want PR previews, on a Docker host I already have, under my own
domain", nothing fits cleanly:
- **Coolify / Dokploy** do PR previews but are full PaaS (panel + DB + generic
  app hosting) — overkill if you only want previews.
- **preevy** is previews-focused but uses tunnels + provisions a VM, and its
  URLs aren't under your domain (breaks cookie/same-site auth).
- **Uffizzi / Qovery / Argo ApplicationSet / vcluster / …** are Kubernetes- or
  SaaS-bound.

prevly fills that gap: **previews-only, runs on a plain Docker host, under your
own wildcard domain, GitHub-native, single binary, secure-by-default.**

## How it works (10-second version)

```
PR opened/updated ──webhook──▶ prevly daemon (on your Docker host)
   for each app whose paths changed:  build (host BuildKit) → run (hardened container)
   embedded proxy (CertMagic) serves  https://pr-<N>-<app>.<your-domain>  (auto TLS)
   sticky PR comment + GitHub Deployment with the URL
PR closed ──▶ torn down.   Idle ──▶ sleeps, wakes on next request in ~1-3s.
```

## Quickstart

On a Docker host with a public IP and a wildcard DNS record
(`*.<base_domain> → host`):

```sh
go build ./cmd/prevly                       # or grab a release binary
cp examples/config.yaml /etc/prevly/config.yaml   # edit base_domain, tls, github
cp examples/env.example /etc/prevly/prevly.env    # fill secrets (never commit)
install -m644 packaging/prevly.service /etc/systemd/system/prevly.service
systemctl enable --now prevly
```

Then create a GitHub App (permissions/events in
[`docs/github-app.md`](./docs/github-app.md)), point its webhook at
`https://<base_domain>/webhook`, install it on your repos, and add a
`.prevly.yml` (`prevly init` scaffolds one; see
[`examples/.prevly.yml`](./examples/.prevly.yml)).

## CLI

```
prevly run       run the daemon (foreground; wrap in systemd)
prevly init      scaffold a .prevly.yml in the current repo
prevly status    list previews across repos
prevly secret    inspect the env-backed secret table
prevly destroy   admin teardown of a PR's previews
prevly doctor    check Docker access, config, disk, rootless
prevly version   version info
```

## Core principles

- **Single Go binary.** The daemon is also the reverse proxy and the ACME
  client (via CertMagic). Nothing else to install.
- **Frontend previews against an existing backend** (not full ephemeral envs).
- **Secure by default.** Hardened containers, isolated networks, no prod secrets,
  fork-PR gating. (Rootless Docker recommended.)
- **Cloud-agnostic.** Anything with a Docker daemon: Hetzner, Scaleway, OVH,
  bare metal, a laptop. No Kubernetes, no per-cloud SDK.
- **GitHub-native UX.** Sticky PR comment + GitHub Deployments + ChatOps
  (`/preview redeploy|destroy|status`). No custom web dashboard.

## Documentation map

| Doc | Contents |
|---|---|
| [`spec.md`](./spec.md) | Canonical product spec + all locked decisions |
| [`docs/architecture.md`](./docs/architecture.md) | Components, data flow, state, reconciler, embedded proxy |
| [`docs/config-reference.md`](./docs/config-reference.md) | Full `.prevly.yml` + host config schema, examples |
| [`docs/lifecycle-and-cli.md`](./docs/lifecycle-and-cli.md) | PR event state machine, sleep/wake, ChatOps, CLI |
| [`docs/build-run.md`](./docs/build-run.md) | Build engine, per-app cache, hardened run, sleep/wake |
| [`docs/tls-dns.md`](./docs/tls-dns.md) | CertMagic, DNS-01 (Route53/Cloudflare), on-demand, subdomains |
| [`docs/github-app.md`](./docs/github-app.md) | GitHub App: permissions, events, install, auth, PR feedback |
| [`docs/security.md`](./docs/security.md) | Threat model + hardening |
| [`docs/decisions.md`](./docs/decisions.md) | Decision log (what + why + rejected alternatives) |
| [`docs/implementation-plan.md`](./docs/implementation-plan.md) | Suggested Go module layout + build milestones |

## License

MIT.
