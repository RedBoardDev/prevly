# Decision log

Each decision, the choice, why, and what was rejected. (Captured during product
discovery; this is the "why" behind the spec.)

| # | Decision | Choice | Why / rejected |
|---|---|---|---|
| 1 | Form factor | **Go daemon + GitHub App** (Amplify-like, multi-repo) | Robust state/GC, no Actions minutes, "install once". Rejected: Action+proxy (drop-in but pull_request_target footguns, no state); CLI-in-CI (preevy-style, state/teardown messy). Webhook needs a public endpoint — fine on a VPS. |
| 2 | Language | **Go** | Single static binary, Docker SDK, easy daemon. Rejected: Node/TS (runtime+deps), Rust (overkill). |
| 3 | Scope | **Frontend previews → existing backend** | The actual need ("preview a frontend PR"). Rejected: full ephemeral env (front+api+db per PR) — much bigger, out of scope. |
| 4 | Build input | **Dockerfile only** (static included) | Predictable, works for any project, zero per-framework magic. Rejected: auto-detect/buildpacks (Vercel-like DX but heavy magic + maintenance). |
| 5 | Proxy + TLS | **Embedded in prevly via CertMagic** | Single-binary thesis; one lib gives DNS-01 wildcard + on-demand. Rejected: orchestrate external Traefik/Caddy (2 components to install). |
| 6 | Subdomain | **`pr-<N>[-<app>].<base>`** | Multi-app repos need the app segment to disambiguate; single-app → `pr-<N>`. Rejected: global `pr-<N>` + path routing (breaks SPA/Next basePath/assets). |
| 7 | Tunnel mode | **Deferred to v1.1**, behind an `Ingress` interface | Custom domain covers the real need + cookie/same-site; a self-hosted tunnel server is weeks of work. cloudflared is the lighter v1.1 path. |
| 8 | State store | **bbolt** | Pure-Go, ACID, no cgo, fits a small KV (`PR×app→record`). Rejected: SQLite (cgo / overkill for KV), JSON files (fragile under concurrency). |
| 9 | Secrets | **Daemon env vars by name (v1)** | Previews carry no prod secrets (front→existing backend), so an encrypted store is overkill for v1. Encrypted store can come later. |
| 10 | Idle handling | **Sleep (`docker stop`) + wake-on-request (`docker start`)** | Saves RAM for idle previews; wake ≈ 1-3s container restart, **no rebuild**. Rejected: keep-running-until-TTL (wastes RAM), destroy-on-idle (loses fast wake). |
| 11 | Security (v1) | **Hardened containers + isolated net + limits + fork gating + rootless (reco)** | Secure-by-default without complexity. Rejected for v1: gVisor/microVM (kept as future opt-in for public/untrusted use). |
| 12 | Git providers | **GitHub only (v1)**, behind an interface | Focus the biggest ecosystem; GitLab/Gitea later without rewrite. |
| 13 | Config | **`.prevly.yml` (repo) + host config** | GitOps, versioned, no UI to build. Rejected: web dashboard (custom UI). |
| 14 | PR UX | **Sticky comment + native GitHub Deployment** | Vercel-like, zero custom UI. Rejected: web dashboard. |
| 15 | Multi-app + path filters | **`apps[]` each with `paths:`** | Monorepo support; deploy ONLY apps a PR touches (not all). |
| 16 | Branch filters | **`triggers.target_branches` / `exclude_head_branches`** | Previews on PRs (never on `main` itself), exclude e.g. dependabot. |
| 17 | License / distribution | **MIT**; binary (goreleaser) + Docker image + systemd unit | Max adoption; install anywhere. |
| 18 | Onboarding | **`prevly init` + host docs** | Low-friction start. |
