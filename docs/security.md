# Security

## Threat model

A preview **builds and runs code from a pull request** — including its
dependencies' install/build scripts. Treat that code as **potentially hostile**
(malicious dependency, compromised contributor, fork PR). Risks: container
escape → host compromise, secret exfiltration, resource abuse, lateral movement
to other previews.

## v1 baseline (secure-by-default, no exotic runtime)

Applied to **both build and run** (the build runs PR code too):
- `--cap-drop=ALL` (add back only what's strictly required).
- `--security-opt=no-new-privileges`, default **seccomp** profile, **read-only
  rootfs** where feasible (writable tmpfs for what needs it).
- **Resource limits** per preview: `--cpus`, `--memory`, `--pids-limit` (DoS guard).
- **Network isolation**: a dedicated Docker network per preview; no access to the
  host, the daemon, or other previews. Only egress needed (to reach the backend).
- **Never** mount the Docker socket into a preview container.
- **No production secrets** in previews — only scoped, non-prod values from the
  daemon (`secrets:` by name), injected at runtime, never baked, never logged
  (masked).
- **Fork-PR gating**: PRs from forks do **not** auto-build; they require a
  maintainer label/approval (author-association check on the GitHub App side).
  Same-repo PRs (trusted contributors) build automatically.
- **Webhook HMAC** verification; **least-privilege** installation tokens.

## Recommended deployment hardening

- Run the daemon (and thus the Docker it drives) under **rootless Docker**: a
  container escape lands as an unprivileged user, not host root. Big payoff,
  low cost. Documented as the recommended setup.
- Keep the host firewalled to 443 (+ 80 for ACME if used) and SSH allowlisted.

## Explicitly NOT in v1 (documented as future hardening)

- **gVisor (`runsc`)** or **microVM (Kata/Firecracker)** runtimes for stronger
  syscall/VM isolation — relevant if you open prevly to **public repos /
  untrusted contributors at scale**. v1 stays simple; these are an opt-in
  `runtime:` knob later.

## Guidance to users

- **Private repos / trusted teams**: the v1 baseline is appropriate.
- **Public repos**: require approval for fork PRs (never auto-run untrusted
  code), keep previews free of any sensitive value, and consider the future
  gVisor option before enabling open contribution.

## Notes for the implementer

- The single biggest correctness/security requirement is that **untrusted code
  never runs with privileges or near secrets**. Get the run/build flags + network
  isolation + fork gating right before anything else.
- Surface a `prevly doctor` check that warns if Docker is **not** rootless and if
  any preview would receive a value that looks like a prod secret.
