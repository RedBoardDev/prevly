# Implementation plan

Suggested build order for prevly v1. Read `spec.md` + all `docs/` first. Dogfood
target: **KARE** (`pr-<N>-bo.staging.kare-app.fr`, `pr-<N>-audit…`).

## Module layout

See [architecture.md](./architecture.md) → `cmd/prevly` + `internal/{config,
github,reconcile,builder,runtime,ingress,store,secrets,model,log}`.

## Milestones

- **M0 — Scaffold.** `go mod`, cobra CLI skeleton (`run`, `init`, `secret`,
  `status`, `doctor`, `version`), structured logging, host-config + `.prevly.yml`
  loading **with validation**, bbolt store with the `Preview` model. *Done: `go
  build ./cmd/prevly` + `go test ./...` green; config parse/validate unit-tested.*
- **M1 — GitHub App.** Webhook HTTP server + HMAC verify; App-JWT → installation
  token; parse `pull_request` events; fetch changed files; **path filter** +
  **branch filter** logic → "which apps to deploy". *Done: unit tests for
  filtering; webhook signature verified.*
- **M2 — Build & run.** Docker client: build via BuildKit (per-app cache),
  hardened `docker run` (caps/seccomp/limits/per-preview network/no socket),
  record state. *Done: integration test against a real Docker daemon builds+runs
  a sample app; hardening flags asserted.*
- **M3 — Ingress.** Embedded reverse proxy (`httputil.ReverseProxy`) routing by
  state (host→container) + **CertMagic** TLS (DNS-01 wildcard; on-demand option).
  *Done: a request to `pr-N-app.<domain>` reaches the container over HTTPS.*
- **M4 — PR feedback.** Sticky comment (find-or-update by marker) + GitHub
  Deployment per app with `environment_url`; surface build failures (log excerpt).
- **M5 — Lifecycle.** Idle **sleep** + **wake-on-request**, **TTL** destroy,
  **reconciler** (desired vs actual, orphan GC), resource limits + build queue,
  **ChatOps** (`/preview redeploy|destroy|status`), teardown on PR close.
- **M6 — Polish & ship.** `prevly init` (scaffold + app detection), `prevly
  doctor`, secrets CLI, **goreleaser** (binaries + Docker image), systemd unit,
  user docs (install + GitHub App setup + DNS/TLS).

## Suggested dependencies

- CLI: `spf13/cobra`
- GitHub: `google/go-github`, `golang-jwt/jwt`, `bradleyfalzon/ghinstallation`
- Docker: `github.com/docker/docker/client` (+ BuildKit) — or shell out to
  `docker`/`buildx` for v1 simplicity
- TLS/proxy: `github.com/caddyserver/certmagic` + stdlib `net/http/httputil`
- State: `go.etcd.io/bbolt`
- Config: `gopkg.in/yaml.v3`

## Testing

- **Unit**: config load/validate, path/branch filtering, subdomain derivation,
  state transitions, secret resolution.
- **Integration** (real Docker): build → run → proxy → stop → wake → destroy.
- **E2E** (optional): a sample repo + a fake/staged GitHub webhook → full flow.

## Open implementation items (decide while coding)

1. GitHub App: finalize exact permissions/events + ship an App manifest.
2. Build/run sandbox specifics: precise cap set, seccomp profile, network policy;
   document the rootless-Docker setup.
3. `.prevly.yml` schema: finalize + strict validation + clear PR-surfaced errors.
4. v1.1: cloudflared `Ingress` implementation (NAT/no-public-IP hosts).

## Non-goals (do NOT build in v1)

PaaS features, databases/ephemeral backends, Kubernetes, multi-cloud SDKs,
framework auto-detection, web dashboard, GitLab/Gitea, gVisor runtime, tunnel
mode (v1.1).
