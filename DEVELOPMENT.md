# Development

prevly is a single Go binary. This document covers building, testing and running
it locally.

## Prerequisites

- Go 1.24+ (the module targets the toolchain in `go.mod`).
- Docker (for running the daemon end-to-end; unit tests do **not** need it).
- `git` on `PATH` (the daemon shells out to it to check out PR sources).

## Layout

```
cmd/prevly/                entrypoint + cobra CLI
internal/
  config/                  .prevly.yml + host config: load, validate, filters, host derivation
  github/                  webhook verify/parse, App auth, changed files, ChatOps, PR feedback
  reconcile/               control loop: events, deploy/teardown, sleep/wake, TTL, orphan GC
  builder/                 docker build (BuildKit) + PR-head checkout
  runtime/                 hardened docker run/stop/start/rm + per-preview networks
  ingress/                 embedded reverse proxy + CertMagic TLS, wake-on-request
  store/                   bbolt state (source of truth)
  secrets/                 resolve secret names from env
  model/                   shared domain types + lifecycle state machine + naming
  log/                     structured logging
```

## Build

```sh
go build ./cmd/prevly          # produces ./prevly
```

## Test & vet

```sh
go vet ./...
go test ./...
```

Tests are unit-only and hermetic (no Docker, no network): they cover config
load/validation, per-app path filtering, branch filtering, subdomain derivation,
the preview state machine, webhook signature verification, the hardened run/build
argument construction, the proxy routing/on-demand gating, and the reconciler
lifecycle (deploy, fork gating, sleep, TTL, orphan GC, wake-on-request).

## Run locally

1. Copy and fill the configs:
   ```sh
   cp examples/config.yaml /etc/prevly/config.yaml
   cp examples/env.example /etc/prevly/prevly.env   # never commit a real .env
   ```
2. Provide the GitHub App private key at the `private_key_path` in the config.
3. Export the environment (webhook secret, secret values, DNS provider creds):
   ```sh
   set -a; . /etc/prevly/prevly.env; set +a
   ```
4. Run:
   ```sh
   ./prevly run --config /etc/prevly/config.yaml
   # or: PREVLY_CONFIG=/etc/prevly/config.yaml ./prevly run
   ```

Other commands:

```sh
./prevly init                  # scaffold a .prevly.yml in the current repo
./prevly status                # list previews across repos
./prevly secret list           # show declared secrets and whether their env is set
./prevly doctor                # check docker access, config, disk, rootless
./prevly destroy org/repo 42   # admin teardown of a PR's previews
./prevly version
```

## Release

Releases are produced by [goreleaser](https://goreleaser.com):

```sh
goreleaser release --clean        # tagged release: binaries + Docker image
goreleaser build --clean --snapshot   # local snapshot build
```

Artifacts: Linux amd64/arm64 binaries, a multi-arch Docker image
(`ghcr.io/redboarddev/prevly`), and the systemd unit under `packaging/`.

## Conventions

- Commits follow Conventional Commits (`type(scope): description`).
- Code, comments and docs are in English; comments explain *why*, not *what*.
- Secrets come only from the environment; never commit a `.env` or a key.
