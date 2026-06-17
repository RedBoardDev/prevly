# Configuration reference

Two configs: **`.prevly.yml`** (committed per repo, describes the apps) and the
**host config** (on the daemon host, describes the host/domain/secrets/limits).

## `.prevly.yml` (repo root)

```yaml
version: 1

# Which PRs get previews. Previews are per-PR; a base branch is never previewed.
triggers:
  target_branches: [main]          # base branches whose PRs get previews
  exclude_head_branches: []        # optional globs to skip (e.g. ["dependabot/**"])

# One or more apps. Each deploys ONLY when the PR touches files in its `paths`.
apps:
  - name: backoffice               # unique per repo; used in URL + state key
    paths:                         # glob list; PR diff ∩ paths ≠ ∅ → this app deploys
      - "apps/backoffice/**"
      - "packages/ui/**"
      - "packages/sdk/**"
      - "yarn.lock"
    dockerfile: apps/backoffice/Dockerfile
    context: "."                   # build context (default repo root)
    subdomain: bo                  # → pr-<N>-bo.<base_domain>  (omit if single-app → pr-<N>.<base_domain>)
    port: 3000                     # container port the app listens on
    build_args:                    # baked at build (public values only)
      NEXT_PUBLIC_API_URL: https://api.bo.staging.kare-app.fr
    env:                           # runtime env (non-secret)
      NODE_ENV: production
    secrets:                       # names resolved from the daemon (injected at runtime)
      - NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
    healthcheck:                   # optional; used for readiness on deploy + wake
      path: "/"
      timeout: 30s

# Lifecycle (optional; fall back to host defaults)
ttl: 30d                           # destroy a preview untouched for this long
idle: 6h                           # sleep (stop) a preview untouched for this long
```

Field notes:
- `paths` — the **per-app path filter** (the headline feature): a PR that only
  touches `apps/audit/**` deploys *only* the audit preview. Globs match the PR
  diff's changed files.
- `subdomain` — optional for single-app repos (then `pr-<N>.<base_domain>`).
- `build_args` are **baked** (public, in the image) — never put secrets here.
- `secrets` reference **names**; values come from the daemon's secret resolution
  (env in v1), injected at **runtime** (not baked).

## Host config (`/etc/prevly/config.yaml`)

```yaml
base_domain: preview.staging.kare-app.fr   # previews at pr-<N>[-<app>].<base_domain>

tls:
  mode: dns-01                     # dns-01 | on-demand
  provider: route53                # route53 | cloudflare (CertMagic providers)
  # provider creds via env (AWS_*, CLOUDFLARE_API_TOKEN, …), never in this file
  email: ops@example.com           # ACME account email

github:
  app_id: 123456
  private_key_path: /etc/prevly/github-app.pem
  webhook_secret_env: PREVLY_WEBHOOK_SECRET   # read from env, not inline

secrets:                           # v1: names mapped to daemon env vars
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: env:PREVLY_SECRET_SA_KEY

limits:
  max_concurrent_builds: 2
  max_concurrent_previews: 30
  per_preview:
    cpu: "1.5"                     # docker --cpus
    memory: "512m"                 # docker --memory
    pids: 512                      # docker --pids-limit

defaults:
  ttl: 30d
  idle: 6h

data_dir: /var/lib/prevly          # bbolt state, build cache metadata, certs
```

Secrets and tokens are **never** written into either file — they come from the
host environment (systemd `EnvironmentFile`, mode 600).

## Validation

`prevly` validates both configs on load and on each `.prevly.yml` change in a PR.
Errors are surfaced **in the PR** (sticky comment + Deployment `failure`), e.g.
"app `backoffice`: `dockerfile` not found", "duplicate subdomain", "invalid glob".
