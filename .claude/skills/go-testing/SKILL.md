---
name: go-testing
description: Go testing conventions for prevly — table-driven tests, subtests, parallelism, fakes via interfaces, golden files, and what (and what not) to test. Apply when writing or changing tests.
---

# Go testing (prevly)

Tests encode **why** behavior matters, not just what. A test that can't fail when
the business rule changes is wrong.

## Structure
- **Table-driven** tests with `t.Run(tc.name, …)` subtests. Name cases by the
  behavior they assert.
- Use `t.Parallel()` for pure/independent cases. Use `t.Helper()` in assertion
  helpers. Use `t.Cleanup()` for teardown (not `defer` chains across helpers).
- Prefer stdlib `testing`; tiny hand-rolled asserts or `cmp.Diff` over a heavy
  framework. Compare with `google/go-cmp` for structs.

## What to test (priorities for prevly)
- `config`: load + **validation** (good + bad `.prevly.yml`/host config, clear
  errors), defaults.
- `github`: **path filter** (diff ∩ paths), **branch filter**, webhook HMAC
  verify, event→apps mapping.
- `ingress`/`runtime`: **subdomain derivation**, host→preview routing decisions.
- `store`/`reconcile`: **state transitions** (building→running→sleeping→running→
  destroyed; failed), idle/TTL decisions, orphan detection.
- Don't test the Docker daemon or GitHub itself — test **your logic** against
  **fakes** of those interfaces. Keep real-Docker/real-GitHub in clearly-tagged
  integration tests.

## Fakes & isolation
- Because external systems sit behind interfaces (see `go-style` /
  `prevly-architecture`), unit tests use **in-memory fakes**, not moc frameworks.
- Integration tests (real Docker) go behind a build tag or `testing.Short()`
  guard so `go test ./...` stays fast and hermetic by default.

## Golden files
- For generated output (e.g. a rendered PR comment, a built config), keep
  `testdata/` golden files with a `-update` flag pattern. Review goldens in PRs.

## Hygiene
- Deterministic: no real time/network/filesystem unless that's the unit under
  test (inject a clock/`fs`/transport). Run concurrency tests with `-race`.
- No skipped tests left in `main`. If you must skip, `t.Skip` with a reason.
