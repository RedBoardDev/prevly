# CLAUDE.md — prevly

Building **prevly**: a single-binary, self-hosted, GitHub-native, per-PR **preview
daemon** for frontend projects — the open-source "Amplify previews", no
Kubernetes, no cloud lock-in. Language: **Go**. License: **MIT**.

## Read first — the docs ARE the spec (source of truth)

`README.md`, `spec.md`, and `docs/*` define the product. Build to them, not to
your own ideas.
- `docs/implementation-plan.md` — milestones (M0–M6) + Go module layout + deps.
- `docs/decisions.md` — every locked decision **and why** (don't relitigate).
- `docs/architecture.md` — components, data flow, package layout.
- `docs/config-reference.md` — `.prevly.yml` + host config schema.
- `docs/build-run.md`, `docs/tls-dns.md`, `docs/github-app.md` — engine details.
- `docs/security.md` — **non-negotiable** security baseline.

If a doc is ambiguous or silent on something that changes the work, **ask or note
it — never invent scope.**

## Golden rules

1. **Clean, idiomatic, expert Go.** Code must read like the standard library.
   Follow the `go-style`, `go-testing`, `prevly-architecture`, and `go-review`
   skills on every change — they are not optional.
2. **Surgical, zero scope creep.** Implement the current milestone, nothing
   speculative. Respect the **non-goals** (no PaaS/DB/k8s/dashboard/tunnel/gVisor
   — see `docs/implementation-plan.md`).
3. **Security is non-negotiable** (`docs/security.md`): untrusted PR code never
   runs with privileges or near secrets. Container hardening + network isolation
   + fork-PR gating come before features.
4. **Test what matters** (`go-testing`): config/validation, path & branch
   filtering, subdomain derivation, state transitions — table-driven.
5. **Fail loud.** No silent error-swallowing; wrap errors with context.

## Commands (must pass before every commit)

```sh
gofmt -l .            # zero output
go vet ./...
golangci-lint run     # clean
go build ./cmd/prevly
go test ./...         # add -race for any concurrency
```

## Workflow

- Work **milestone by milestone** (`docs/implementation-plan.md`). After each:
  build + vet + test green, then a **conventional commit** (`feat`, `fix`,
  `refactor`, `test`, `docs`, `chore`). No AI mentions in commit messages. Never
  commit secrets or `.env` (only `.env.example` / config examples).
- Keep `main` buildable at all times. Branch per milestone if helpful.
- Checkpoint each milestone: what's done, what's verified, what's next.

## Architecture rules (summary — full detail in docs/architecture.md)

- Package layout per `docs/architecture.md`; **small, single-purpose packages**.
- Wrap external systems (Docker, GitHub, ACME/DNS, store) behind **interfaces
  defined by the consumer** → testable + swappable. Keep the `Ingress` interface
  so a tunnel backend plugs in later without touching callers.
- `main`/`cmd` is thin (flag parsing + wiring). **No global mutable state.**
  `context.Context` first param for anything doing I/O. Structured logging with
  `log/slog`.
