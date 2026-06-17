# prevly — spec (v0, draft)

> Living document. We refine it incrementally and validate each section before
> writing code. Nothing here is final until marked **LOCKED**.

## One-liner

**prevly** is a single Go binary you run on any Docker host. Install its GitHub
App on a repo and every pull request gets a live **preview URL** of the
frontend(s) built from that PR — redeployed on each commit, torn down when the
PR closes. The open-source, self-hostable, cloud-agnostic, secure-by-default
"Amplify previews", with **no Kubernetes and no cloud lock-in**.

## Why (the gap)

Existing options don't fit "just previews, on my own Docker host, under my own
domain":
- **Coolify / Dokploy** do PR previews but are full PaaS (panel + DB + generic
  app hosting) — overkill if you only want previews.
- **preevy** is previews-focused but uses tunnels + provisions a VM, and its
  URLs aren't under your domain (breaks cookie/same-site auth).
- **Uffizzi / Qovery / Argo ApplicationSet / vcluster / …** are Kubernetes- or
  SaaS-bound.

prevly fills the empty niche: **previews-only, runs on a plain Docker host you
already have, under your own wildcard domain, GitHub-native, one binary.**

## Non-goals (v1)

- Not a PaaS / not generic app hosting (no databases, no long-lived services).
- No Kubernetes, no per-cloud SDKs (cloud-agnostic = plain Docker only).
- Frontend previews against an **existing** backend — not full ephemeral
  backend/DB environments per PR.
- No web dashboard UI (GitHub-native UX only).
- No framework auto-detection / zero-config build (Dockerfile-based).

## Decisions (LOCKED via product discovery)

| Axis | Decision |
|---|---|
| Form factor | Go daemon + GitHub App (multi-repo; install on the org) |
| Trigger | GitHub webhook (host needs a public endpoint) |
| Project config | `.preview.yml` committed in the repo + daemon host config |
| Scope | frontend only → talks to an existing backend; **Dockerfile for everything** (static included) |
| URL / TLS | custom wildcard domain; ACME **DNS-01** or **on-demand TLS** |
| Reverse proxy | **embedded in prevly** via **CertMagic** (no external Traefik/Caddy) — single binary does routing + TLS |
| Subdomain scheme | `pr-<N>[-<app>].<base_domain>` — `-<app>` added only for multi-app repos (single-app → `pr-<N>.<base_domain>`) |
| Ingress model | **direct** (host reachable) in v1, behind a clean `Ingress` interface so a **tunnel** backend can plug in later |
| Secrets | non-sensitive in `.prevly.yml`; others as daemon **env vars** by name (previews carry no prod secrets; encrypted store can come later) |
| Security | hardened containers + per-preview isolated network + resource limits + scoped secrets + fork-PR gating (rootless Docker recommended). **No gVisor in v1.** |
| Governance | destroy on PR close + configurable **TTL (default 30d)** since last activity |
| Commands | **PR ChatOps**: `/preview redeploy`, `/preview destroy`, `/preview status` |
| PR UX | sticky comment + **native GitHub Deployment** (no custom UI) |
| Debugging | read Docker logs on the host (v1) |
| Providers | GitHub only (interface kept clean to add GitLab/Gitea later) |
| Stack | Go (single static binary) |
| License | **MIT** |

## Core concepts

- **App** — one buildable+servable unit in a repo (a repo may declare several:
  monorepo). Each app → its own preview container + subdomain.
- **Preview** — one running instance of an app for a given PR
  (`PR #N × app`), reachable at a URL, with a lifecycle (create → redeploy →
  destroy).
- **Path filter** — globs that decide whether a PR affects an app (so a PR that
  only touches `apps/audit/**` deploys *only* the audit preview, not all apps).

## Architecture (high level)

```
GitHub PR event ──webhook──▶  prevly daemon (Go, on the Docker host)
                                  │  (state: PR×app → container, image, last_seen, ttl)
   per app, IF the PR touched its `paths`:
                                  ├─ clone PR head (installation token)
                                  ├─ docker build (hardened, no socket)      [sandboxed: runs PR code]
                                  ├─ docker run  (hardened, isolated net,     1 container per PR×app
                                  │               labels → reverse proxy)
                                  ▼
                   prevly's EMBEDDED proxy (CertMagic) ── wildcard/on-demand TLS ── *.<base_domain>
                                  │
                                  ├─ sticky PR comment + GitHub Deployment (URL + status)
   on PR close / TTL / `/preview destroy`:  docker rm + prune  (+ reconciler GC for orphans)
```

- **State is the source of truth**, webhooks are best-effort → a reconciler loop
  enforces desired vs actual and sweeps orphans (missed close events, past TTL).

## `.preview.yml` (project config) — DRAFT schema

```yaml
version: 1

# Which PRs get previews (Amplify-like). Previews are per-PR; a base branch is
# never previewed on its own.
triggers:
  target_branches: [main]        # base branches whose PRs get previews
  exclude_head_branches: []      # optional globs to skip (e.g. "dependabot/**")

# One or more apps. Each app deploys ONLY when the PR changes files in `paths`.
apps:
  - name: backoffice
    paths:                       # path filter (like GitHub `paths` / turbo --affected)
      - "apps/backoffice/**"
      - "packages/ui/**"
      - "packages/sdk/**"
      - "yarn.lock"
    dockerfile: apps/backoffice/Dockerfile
    context: .
    subdomain: bo                # → pr-<N>-bo.<base_domain>
    port: 3000
    build_args:
      NEXT_PUBLIC_API_URL: https://api.bo.staging.kare-app.fr
    secrets:                     # names resolved from the daemon's encrypted store
      - NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
  - name: audit
    paths: ["apps/audit/**", "packages/sdk/**", "yarn.lock"]
    dockerfile: apps/audit/Dockerfile
    subdomain: audit
    port: 3000
    build_args:
      NEXT_PUBLIC_API_URL: https://api.ad.staging.kare-app.fr

ttl: 30d                         # auto-destroy after this since last activity
```

## Host config (daemon) — DRAFT

Lives on the host (e.g. `/etc/prevly/config.yaml`), never in a repo:
- `base_domain` (e.g. `staging.kare-app.fr` → previews at `pr-<N>-<app>.<base_domain>`)
- DNS-01 provider + credentials (for the wildcard cert)
- encrypted secret store (key + entries)
- defaults: per-preview CPU/mem/pids limits, max concurrent previews, default TTL
- GitHub App credentials (app id, private key, webhook secret) + `GITHUB_TOKEN`-less (App auth)

## Lifecycle

1. **PR opened / synchronized / reopened** → for each app whose `paths` matched
   the PR diff: build + (re)deploy its preview, update the sticky comment +
   GitHub Deployment with the URL/status. Apps not touched are left untouched.
2. **PR closed/merged** → destroy that PR's previews.
3. **TTL** → a preview untouched for `ttl` is destroyed (reconciler).
4. **ChatOps** (PR comment): `/preview redeploy [app]`, `/preview destroy [app]`,
   `/preview status`.

## URL & TLS

- Default: `pr-<N>-<app.subdomain>.<base_domain>` (per-app subdomain). A
  single-app repo may omit `subdomain` → `pr-<N>.<base_domain>`.
- One wildcard cert `*.<base_domain>` via Let's Encrypt **DNS-01** (instant new
  subdomains, no per-PR cert). DNS-01 provider configured host-side.
- For KARE: `pr-<N>-bo.staging.kare-app.fr`, `pr-<N>-audit.staging.kare-app.fr`
  (under `.staging` so the staging API cookie is shared → login works).

## Security model (v1)

Every build AND run (both execute PR code) is confined:
- `--cap-drop=ALL` (+ only what's needed), `--security-opt=no-new-privileges`,
  default seccomp, read-only rootfs where possible.
- **Never** mount the Docker socket into a preview.
- One isolated Docker network per preview (no reach to host services / other
  previews).
- CPU / memory / pids / disk limits per preview.
- **No production secrets** in previews — only scoped values from the daemon store.
- **Fork-PR gating**: PRs from forks require an approval/label before they build
  (untrusted code). Private repos = lower baseline risk.
- **Recommended**: run the daemon under **rootless Docker** (an escape lands
  unprivileged). gVisor/microVM = possible later opt-in, not v1.

## Governance

- Destroy on PR close + TTL (default 30d) via the reconciler.
- Resource caps + max concurrent previews so the host never saturates.
- Daily prune of dangling images/build cache (host).

## Engine & ops (v1)

- **Build**: prevly calls the host **Docker daemon (BuildKit)**, with a
  **per-app persistent layer cache** → warm rebuilds in seconds. The RUN is
  hardened separately (see Security).
- **State**: embedded **bbolt** (pure-Go, ACID, no cgo) — `PR×app → {container,
  image, status, last_seen, ttl}`. Reconciler treats state as source of truth.
- **Secrets**: daemon **env vars** referenced by name from `.prevly.yml`.
- **Idle → sleep / wake-on-request**: a preview untouched for `idle` (default
  ~6h) is **stopped** (`docker stop` — frees RAM/CPU, keeps container+image).
  On the next request the embedded proxy does `docker start` + wait-ready
  (**~1–3s, no rebuild**) then serves. States: running / sleeping / destroyed.
- **Resource limits**: configurable max concurrent builds + max concurrent
  previews + build queue (sane defaults); per-preview CPU/mem/pids caps.
- **Errors**: a failed build/deploy → sticky PR comment + GitHub Deployment
  `failure` + last log lines (debug without SSHing the host).
- **Config file**: `.prevly.yml` at repo root; `prevly init` scaffolds it.
- **TLS/DNS**: CertMagic — **Route53 + Cloudflare** DNS-01 first (more easy to
  add) + **on-demand TLS** as the no-DNS-config path.
- **Distribution**: single Go binary via **goreleaser** (GitHub Releases) + a
  Docker image + a systemd unit.
- **License**: MIT.

## Roadmap

- **v1**: everything in the LOCKED table above. GitHub, custom wildcard domain,
  Dockerfile builds, multi-app + path filters, branch filters, ChatOps,
  sticky comment + Deployment, TTL/teardown, hardened isolation.
- **v1.1**: **tunnel mode** via **cloudflared** (NAT traversal for hosts without
  a public IP; plugged behind the `Ingress` interface). Note: relocates — does
  not remove — the public endpoint, and carries the cookie/same-site caveat.
  (A self-hosted tunnel server, preevy-style, is a much bigger build — later.)
- **Later**: GitLab/Gitea, optional gVisor runtime, web dashboard, build-cache
  sharing, log access via CLI/URL.

## Open questions / TBD

Most product decisions are made. Remaining = implementation detail, to nail
when we start coding:

1. **GitHub App**: exact minimal permissions + which webhook events + install flow.
2. **Build/run sandbox** specifics: capability set, seccomp profile, per-preview
   network policy; rootless-Docker recommendation in docs.
3. **`.prevly.yml` schema** finalization + validation rules (errors surfaced to PR).
4. **Tunnel mode (v1.1)**: cloudflared integration behind the `Ingress` interface.
