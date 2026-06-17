# Architecture

prevly is **one Go binary** running as a daemon on a Docker host. It is, at once:
the GitHub webhook receiver, the build/run orchestrator, the **reverse proxy**,
and the **ACME/TLS** client. No external proxy, no database server, no
Kubernetes.

## Components (all in-process unless noted)

```
                           ┌──────────────────────────── prevly daemon (Go) ───────────────────────────┐
GitHub ──webhook (HTTPS)──▶│  HTTP server (webhook + ChatOps + ACME HTTP-01 if used)                    │
                           │      │                                                                     │
                           │      ▼                                                                     │
                           │  Reconciler  ◀── state (bbolt)  ── desired vs actual, TTL/idle sweeps      │
                           │      │                                                                      │
                           │      ├─ Builder      ── host Docker daemon / BuildKit (+ per-app cache)     │
                           │      ├─ Runtime      ── docker run (hardened, isolated net, labels)         │
                           │      ├─ Ingress       ── EMBEDDED reverse proxy + CertMagic (TLS)           │──▶ previews
                           │      ├─ GitHub client ── installation token: clone, comment, Deployment     │
                           │      └─ Secrets       ── daemon env, resolved by name                       │
                           └───────────────────────────────────────────────────────────────────────────┘
                                            │ docker API (/var/run/docker.sock — daemon only, never in previews)
                                            ▼
                                   Docker host: preview containers (1 per PR×app) on per-preview networks
```

## Suggested Go package layout

```
cmd/prevly/                 # entrypoint, CLI (cobra): run, init, secret, status, version
internal/
  config/                   # .prevly.yml + host config: load, validate, defaults
  github/                   # App auth (JWT→installation token), webhook verify, PR comment, Deployments, ChatOps
  reconcile/                # the control loop: desired vs actual, TTL/idle, orphan GC
  builder/                  # docker build via BuildKit, per-app cache, build sandboxing
  runtime/                  # docker run/stop/start/rm, hardening flags, per-preview networks
  ingress/                  # embedded reverse proxy + CertMagic (DNS-01 + on-demand); wake-on-request
  store/                    # bbolt state: Preview{PR, app, container, image, status, last_seen, ttl}
  secrets/                  # resolve secret names → values (daemon env in v1)
  model/                    # shared structs (Preview, AppConfig, …)
  log/                      # structured logging
```

> `ingress` is the heart of the "single binary" promise: `httputil.ReverseProxy`
> for routing + **CertMagic** for ACME (DNS-01 wildcard *and* on-demand TLS).
> An `Ingress` interface keeps room for a future **tunnel** backend (v1.1).

## Data model (state, bbolt)

A `Preview` record keyed by `(repo, pr_number, app)`:
- `repo`, `pr_number`, `app_name`, `subdomain`, `url`
- `container_id`, `image_tag`, `commit_sha`
- `status`: `building | running | sleeping | failed | destroyed`
- `created_at`, `last_seen_at` (last request — drives idle/sleep), `ttl`
- `deployment_id` (GitHub Deployment), `comment_id` (sticky PR comment)

**State is the source of truth.** Webhooks are best-effort; the reconciler
re-converges actual Docker state to the desired state from the store and sweeps
orphans (missed close events, past TTL).

## Request flow (data plane)

1. A request hits the embedded proxy on `:443` with host `pr-<N>-<app>.<base>`.
2. Proxy looks up the `Preview` by host.
3. If `running` → proxy to the container.
4. If `sleeping` → `docker start` the container, wait for readiness (~1–3s),
   mark `running`, update `last_seen_at`, then proxy. (Wake-on-request.)
5. If unknown/destroyed → 404 (or a friendly "no preview" page).
6. TLS: CertMagic serves the wildcard cert (DNS-01) or mints on-demand.

## Control flow (events)

- **Webhook `pull_request`** (opened/synchronize/reopened) → for each app whose
  `paths` matched the PR diff: enqueue build+deploy.
- **Webhook `pull_request` closed** → enqueue destroy for that PR's previews.
- **Webhook `issue_comment`** (`/preview …`) → ChatOps action.
- **Reconciler tick** (periodic) → sleep idle previews, destroy past-TTL,
  reap orphans, retry failed transitions.

## Why no external proxy / DB / k8s

Single binary = trivial to `scp` + `systemctl enable` on any Docker host. bbolt
(embedded) avoids a DB server. CertMagic gives production ACME without Caddy/
Traefik. This is the whole "self-host anywhere, secure by default" thesis.
