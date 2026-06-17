# GitHub App

prevly integrates via a **GitHub App** (not a GitHub Action, not OAuth): it
receives webhooks, uses short-lived installation tokens to clone/comment/deploy,
and serves **many repos** from one install (org-level). This is what gives the
"install once → previews everywhere" Amplify-like UX.

## Permissions (minimal)

Repository permissions:
- **Contents: Read** — clone the PR head to build.
- **Pull requests: Read** — read PR metadata + the changed-files list (path filter).
- **Deployments: Read & write** — create the native Deployment + statuses.
- **Issues / Pull requests comments: Write** — the sticky comment + ChatOps replies.
- **Checks: Write** — *(optional)* a check run for pass/fail.
- **Metadata: Read** — baseline.

## Webhook events subscribed

- `pull_request` (opened, synchronize, reopened, closed, ready_for_review)
- `issue_comment` (created) — ChatOps `/preview …`
- `installation` / `installation_repositories` — track which repos are enabled

## Auth model

- App identity = `app_id` + a **private key** (PEM, host-side).
- Per request: sign a short JWT → exchange for an **installation access token**
  scoped to that repo → use it to `git clone` the PR head and call the API
  (comments, deployments). Tokens are short-lived; never persisted.
- Webhook payloads are verified with the **webhook secret** (HMAC-SHA256) before
  any action.

## Delivery (reachability)

The App posts webhooks to prevly's HTTPS endpoint → the **host needs a public
endpoint** (a public IP, like the KARE VPS). Behind NAT, a future option is
polling or a tunnel (v1.1). Suggested libs: `google/go-github`, `golang-jwt/jwt`,
or a higher-level helper like `bradleyfalzon/ghinstallation` for token minting.

## PR feedback implementation

- **Sticky comment**: list this PR's comments, find prevly's by a hidden marker
  (`<!-- prevly -->`), update it in place (create if absent). One comment per PR,
  all apps' status + URLs + a log excerpt on failure.
- **Deployments API**: one Deployment per app (`environment: preview/pr-<N>-<app>`),
  status `in_progress → success | failure` with `environment_url` = the preview
  URL → shows natively in the PR.

## Install flow (for users)

1. Create the App (a **GitHub App manifest** can pre-fill permissions/events).
2. Set the App's webhook URL to the prevly host + the webhook secret.
3. Install the App on the org/repos that want previews.
4. Add `.prevly.yml` to each repo; ensure the host config + DNS + TLS are set.
