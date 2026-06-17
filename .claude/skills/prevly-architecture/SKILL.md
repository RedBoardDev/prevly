---
name: prevly-architecture
description: prevly's package layout, layering, and interface boundaries. Apply when creating files/packages or wiring components, to keep the code aligned with docs/architecture.md and the single-binary design.
---

# prevly architecture rules

Authoritative detail: `docs/architecture.md` + `docs/implementation-plan.md`.
This skill is the quick guardrail.

## Package layout (don't drift)

```
cmd/prevly/          # entrypoint + CLI (cobra). Thin: parse → wire → run.
internal/
  config/            # .prevly.yml + host config: load, validate, defaults
  github/            # App auth, webhook verify, PR comment, Deployments, ChatOps
  reconcile/         # control loop: desired vs actual, TTL/idle, orphan GC
  builder/           # docker build (BuildKit), per-app cache, build sandbox
  runtime/           # docker run/stop/start/rm, hardening flags, per-preview net
  ingress/           # embedded reverse proxy + CertMagic (DNS-01 + on-demand)
  store/             # bbolt state: Preview records
  secrets/           # resolve secret names → values (env in v1)
  model/             # shared structs (Preview, AppConfig, …) — no logic
  log/               # slog setup
```

## Layering & boundaries
- Dependencies point **inward** toward `model`. No import cycles. `cmd` wires
  everything; packages don't import `cmd`.
- Every external system has a **consumer-defined interface**:
  - `runtime`/`builder` → a `Docker` interface (so tests use a fake).
  - `github` → a `GitHub` interface for API calls + a verified webhook decoder.
  - `ingress` → an **`Ingress`** interface (`Publish(host) → URL`, `Route(host)`):
    v1 impl = direct (CertMagic + reverse proxy); a `cloudflared` impl can be
    added later **without touching callers** (tunnel = v1.1).
  - `store` → a `Store` interface over bbolt.
- The **reconciler is the brain**: it reads desired state (from events/config)
  and the store (source of truth) and drives builder/runtime/ingress to converge.
  Webhook handlers should be thin: validate → record intent → let the reconciler act.

## Single-binary invariants
- No external proxy, no DB server, no Kubernetes. The proxy + ACME live in
  `ingress`; state lives in `store` (bbolt). Keep it that way.
- The Docker socket is used **only** by the daemon (builder/runtime) and is
  **never** exposed inside a preview container.

## When adding a feature
1. Does a doc cover it? Build to the doc. 2. Which package owns it? (one) 3. Does
it cross a boundary? Go through the interface. 4. Is it a non-goal? Don't build it.
