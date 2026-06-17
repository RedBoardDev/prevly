# Lifecycle, state machine, ChatOps & CLI

## Preview state machine

```
            build ok                 idle > `idle`            request
  (PR event) ───────▶ running ───────────────────▶ sleeping ──────────▶ running
      │                  │  ▲                           │   (docker start, ~1-3s)
      │ build fail        │  └───────────────────────────┘
      ▼                  │ PR closed / TTL / /preview destroy
   failed                ▼
                      destroyed   (docker rm + image prune)
```

- **building** → `running` (deploy) or `failed`.
- **running** → `sleeping` after `idle` (default 6h) of no requests (`docker stop`).
- **sleeping** → `running` on the next request (wake-on-request: `docker start`,
  wait readiness, then serve — **no rebuild**).
- any → **destroyed** on PR close, past `ttl` (default 30d), or `/preview destroy`.
- **failed** → retried on next push or `/preview redeploy`.

## Event → action

| Trigger | Action |
|---|---|
| `pull_request` opened/synchronize/reopened | for each app whose `paths` matched the PR diff: build + deploy; update sticky comment + Deployment |
| `pull_request` closed/merged | destroy all previews for that PR |
| `issue_comment` `/preview …` | ChatOps (below) |
| reconciler tick | sleep idle previews, destroy past-TTL, reap orphans, retry failed |

The reconciler runs on a timer and treats the **bbolt store as source of truth**
(webhooks are best-effort; missed events are healed here).

## ChatOps (PR comments)

- `/preview status` — list this PR's previews + URLs + state.
- `/preview redeploy [app]` — force rebuild+redeploy (all apps, or one).
- `/preview destroy [app]` — tear down (all, or one).

Only repo members/collaborators may run commands (the GitHub App checks author
association); fork-PR contributors are gated.

## CLI (`prevly …`, on the host)

| Command | Purpose |
|---|---|
| `prevly run [--config …]` | run the daemon (foreground; wrap in systemd) |
| `prevly init` | scaffold a `.prevly.yml` in the current repo (detect apps if possible) |
| `prevly status` | list all previews across repos (state, URL, age, last seen) |
| `prevly secret set <name>` / `list` / `rm <name>` | manage the secret store |
| `prevly destroy <repo> <pr> [app]` | admin teardown |
| `prevly doctor` | check Docker access, DNS/cert, GitHub App connectivity, disk |
| `prevly version` | version info |

## PR UX

- **Sticky comment**: a single bot comment, updated in place — URL(s) + per-app
  status (building / live / failed) + a log excerpt on failure.
- **GitHub Deployment**: a native Deployment per app (the PR's "View deployment"
  button), status `in_progress → success | failure`.
- No custom web dashboard.
