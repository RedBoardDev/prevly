# Build & run engine

## Build

- prevly calls the **host Docker daemon (BuildKit)** — `docker build` /
  buildx — using the app's `dockerfile` + `context` from `.prevly.yml`.
- **Per-app persistent layer cache**: BuildKit reuses the daemon's cache keyed
  per app → warm rebuilds in seconds (measured on a real Next.js app: ~2s warm,
  ~1-2 min cold; **no registry push** — build + run locally).
- **Image tag**: `prevly/<repo>/<app>:pr-<N>-<sha>` (local image, not pushed).
- `build_args` from `.prevly.yml` are passed as `--build-arg` (public, baked).
- The build **executes PR code** (postinstall/build scripts) → it must be
  sandboxed (see [security.md](./security.md)); fork PRs are gated.

## Run

`docker run` the freshly-built image, **hardened**:
- `--cap-drop=ALL` (add back only what's strictly needed)
- `--security-opt=no-new-privileges`, default seccomp, read-only rootfs where possible
- `--cpus`, `--memory`, `--pids-limit` from host `limits.per_preview`
- a **dedicated Docker network per preview** (no reach to host services / other previews)
- **never** mount the Docker socket into a preview
- runtime `env` + resolved `secrets` injected here (secrets at runtime, not baked)

### Routing — no labels needed

Because the reverse proxy is **embedded in prevly** (see
[architecture.md](./architecture.md) and [tls-dns.md](./tls-dns.md)), prevly
already knows `host → container` from its **bbolt state**. The proxy routes by
that map directly — **no Traefik/Caddy labels** on the containers. Containers
are plain hardened `docker run`s on a per-preview network the daemon can reach.

## Sleep / wake (resource efficiency)

- After `idle` (default 6h) with no requests, a `running` preview is **stopped**
  (`docker stop`) → frees RAM/CPU, **keeps the container + image** → state
  `sleeping`.
- On the **next request**, the embedded proxy:
  1. sees the target host maps to a `sleeping` preview,
  2. `docker start`s the existing container,
  3. waits for readiness (port/`healthcheck`, ~1–3s),
  4. marks `running`, updates `last_seen_at`, proxies the request.
- **No rebuild on wake** — only a container restart. Subsequent requests are
  instant. (A rebuild only happens on a new commit or `/preview redeploy`.)

## Teardown & GC

- PR close / past-TTL / `/preview destroy` → `docker rm -f` the container +
  remove its network + prune its image tag.
- The reconciler periodically reaps **orphans** (containers/networks with no
  matching open PR or a destroyed state) and prunes dangling build cache within
  the configured budget.
