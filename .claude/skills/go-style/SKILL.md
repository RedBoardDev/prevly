---
name: go-style
description: Idiomatic, clean, expert-level Go conventions for the prevly codebase. Apply when writing or editing ANY .go file — naming, error handling, interfaces, package design, concurrency, comments, simplicity. The bar is "reads like the Go standard library."
---

# Expert Go style (prevly)

Write Go that a senior reviewer would merge without comments. Idiomatic and
simple beats clever. When unsure, mirror the Go standard library.

## Naming
- Packages: short, lowercase, no underscores/plurals; the name is part of the
  API (`config.Load`, not `config.ConfigLoad`). Avoid stutter (`store.Store` ok,
  `store.StoreState` not).
- Exported identifiers: clear, no Hungarian, no abbreviations beyond common ones
  (`ctx`, `cfg`, `id`, `db`). Getters: `Name()`, not `GetName()`.
- Errors: `ErrNotFound` (sentinel), error vars start with `Err`, error types end
  with `Error`.

## Errors
- Always handle; never `_ =` an error you should check. **No silent swallow.**
- Wrap with context: `fmt.Errorf("loading config %s: %w", path, err)`. Use `%w`
  so callers can `errors.Is`/`errors.As`. Don't prefix messages with "failed to"
  (the chain already implies failure) and don't capitalize/punctuate them.
- Sentinels for expected conditions (`errors.Is`); typed errors when callers need
  fields. **No `panic` in library code** — only truly-unrecoverable startup.
- Return early; keep the happy path un-indented. No `else` after a `return`.

## Interfaces & types
- **Accept interfaces, return concrete types.** Define interfaces **where they're
  consumed**, small (1–3 methods). Don't create an interface "just in case"
  (rule of three).
- Constructors `New…` return the concrete type. Use **functional options**
  (`WithX(...)`) when a constructor has many optional params.
- Zero values should be useful where reasonable. Prefer composition over
  inheritance-style embedding tricks.

## Functions & control flow
- Small, single-purpose functions. No naked returns except in tiny funcs.
- `context.Context` is the **first** parameter for anything doing I/O, and is
  honored (cancellation/timeouts) — never store it in a struct.
- Don't return `interface{}`/`any` from your own APIs.

## Concurrency
- Pass `ctx`; make goroutine lifetimes explicit — **never leak goroutines**.
- Prefer `errgroup.Group` for fan-out with error/cancel propagation.
- Guard shared state with a mutex or a channel; run with `-race` in tests.
- Don't start goroutines in a constructor without a clear stop mechanism.

## Packages & dependencies
- Small, cohesive packages (see `prevly-architecture`). No `util`/`common`
  grab-bags. No import cycles. `internal/` for non-public code.
- Wrap third-party SDKs (Docker, GitHub, ACME) behind your own interface — never
  leak their types across your package boundaries.
- Keep `main` thin: parse flags, build dependencies, run.

## Comments & docs
- Godoc on every exported symbol, starting with the symbol name. Explain the
  **why / contract / trade-off**, not the obvious what. No commented-out code.
- No noise comments restating the code.

## Simplicity (non-negotiable)
- Minimum code that solves the milestone. No speculative abstraction, no config
  knobs nobody asked for, no premature generics. Three similar lines beat a
  premature abstraction.
- `gofmt`/`goimports` clean; `go vet` + `golangci-lint` clean. No `//nolint`
  without a one-line justification.
- Prefer the stdlib; add a dependency only when it clearly earns its place.
