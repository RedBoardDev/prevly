# Kick-off prompt for `/goal`

Open a fresh Claude Code session **in this repo** (`/Users/redboard/delivery/prevly`),
enable auto mode, and paste the text below after `/goal`. It is self-contained,
verifiable (build/test exit codes), scoped to the spec docs, and turn-bounded.

> Tip: optionally run `/plan` first to review the milestone breakdown, then `/goal`.
> If a run hits the turn cap before completion, just run `/goal` again — work
> persists in the repo and it resumes from where it left off. For a tighter first
> pass, replace "milestones M0–M6" with "milestones M0–M2".

---

```
Build the prevly v1 project in this repo following its handoff docs as the single source of truth. FIRST read README.md, spec.md, and every file in docs/ (especially docs/implementation-plan.md, docs/architecture.md, docs/decisions.md, docs/config-reference.md, docs/build-run.md, docs/tls-dns.md, docs/github-app.md, docs/security.md). Then plan the work as milestones M0–M6 from docs/implementation-plan.md and implement them in order, committing after each milestone with a clear conventional-commit message.

The goal is COMPLETE only when ALL of these hold and you have shown it in your output:
1. The Go module and package layout match docs/architecture.md (cmd/prevly + internal/{config,github,reconcile,builder,runtime,ingress,store,secrets,model,log}).
2. `go build ./cmd/prevly` exits 0 and produces the binary.
3. `go vet ./...` and `go test ./...` exit 0 with all tests passing — at minimum unit tests for: config load+validation, per-app path filtering, branch filtering, subdomain derivation, and preview state transitions.
4. Milestones M0–M6 in docs/implementation-plan.md are implemented (GitHub App webhook → path/branch filter → BuildKit build → hardened docker run → embedded CertMagic reverse proxy → sticky PR comment + GitHub Deployment → idle sleep/wake → TTL + reconciler GC → ChatOps), matching the LOCKED decisions in docs/decisions.md and the security baseline in docs/security.md.
5. No hardcoded secrets and no .env committed (only .env.example / config examples); all secrets resolved from env per the docs.
6. README.md stays accurate and a DEVELOPMENT.md with build/test/run instructions exists.

Constraints: do NOT add any non-goal (no PaaS, DB, Kubernetes, web dashboard, framework auto-detection, tunnel mode, or gVisor — see docs/implementation-plan.md "Non-goals"). Keep packages small and focused. After each milestone run `go build` and `go test ./...` and report status. If the goal is not met after 40 turns, stop and summarize what is done and what remains.
```
