---
name: go-review
description: Pre-commit / end-of-milestone self-review checklist for prevly Go code (clean code + security + tests). Run before committing a milestone or opening a PR.
---

# prevly self-review checklist

Run this before committing a milestone. Fix everything before the commit.

## Build & lint (must be green)
- [ ] `gofmt -l .` prints nothing; `goimports` applied.
- [ ] `go vet ./...` clean.
- [ ] `golangci-lint run` clean (no new `//nolint` without a justification).
- [ ] `go build ./cmd/prevly` succeeds.
- [ ] `go test ./...` passes; `-race` on any concurrency code.

## Clean code (see go-style)
- [ ] Errors wrapped with context + `%w`; none silently swallowed; no stray `panic`.
- [ ] Interfaces are small and consumer-defined; no speculative abstraction.
- [ ] `context.Context` threaded through I/O; no leaked goroutines.
- [ ] Exported symbols have godoc explaining the why/contract.
- [ ] No dead code, no commented-out code, no `util`/`common` dumping ground.
- [ ] Smallest change that satisfies the milestone — nothing speculative.

## Security (see docs/security.md — non-negotiable)
- [ ] Preview containers: `cap-drop=ALL`, `no-new-privileges`, seccomp, resource
      limits, dedicated network, **no Docker socket** mounted.
- [ ] Build also runs PR code → same sandboxing; **fork PRs gated**.
- [ ] No prod secrets reach previews; secrets from env, never baked, never logged.
- [ ] Webhook HMAC verified; installation tokens least-privilege + short-lived.
- [ ] No secret / token / `.env` committed.

## Tests (see go-testing)
- [ ] New logic has table-driven unit tests (config, filters, subdomain, state).
- [ ] Tests use fakes of the Docker/GitHub interfaces, not the real systems.
- [ ] A test would actually fail if the business rule changed.

## Docs & commit
- [ ] Behavior matches `docs/*`; if you diverged, the docs were updated (and the
      change is justified) — docs stay the source of truth.
- [ ] Conventional commit message; no AI mentions; staged files by name.
