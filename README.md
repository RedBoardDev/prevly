# prevly

**Per-PR preview environments for frontend projects — self-hosted, one binary, no Kubernetes, no cloud lock-in.**

Install prevly's GitHub App on a repo, drop a `.prevly.yml`, and every pull
request gets a live preview URL of the frontend(s) built from that PR —
redeployed on each commit, torn down when the PR closes. Think "AWS Amplify
previews", but open-source and running on **your own Docker host, under your own
domain**.

> **Status: v1 implemented.** The daemon (webhook → build → run → proxy →
> PR feedback → lifecycle) is built and tested.

## Why

For "I just want PR previews, on a Docker host I already have, under my own
domain", nothing fits cleanly:
- **Coolify / Dokploy** do PR previews but are full PaaS (panel + DB + generic
  app hosting) — overkill if you only want previews.
- **preevy** is previews-focused but uses tunnels + provisions a VM, and its
  URLs aren't under your domain (breaks cookie/same-site auth).
- **Uffizzi / Qovery / Argo ApplicationSet / vcluster / …** are Kubernetes- or
  SaaS-bound.

prevly fills that gap: **previews-only, runs on a plain Docker host, under your
own wildcard domain, GitHub-native, single binary, secure-by-default.**

## How it works (10-second version)

```
PR opened/updated ──webhook──▶ prevly daemon (on your Docker host)
   for each app whose paths changed:  build (host BuildKit) → run (hardened container)
   embedded proxy (CertMagic) serves  https://pr-<N>-<app>.<your-domain>  (auto TLS)
   sticky PR comment + GitHub Deployment with the URL
PR closed ──▶ torn down.   Idle ──▶ sleeps, wakes on next request in ~1-3s.
```

## Quickstart

On a Docker host with a public IP and a wildcard DNS record
(`*.<base_domain> → host`):

```sh
go build ./cmd/prevly                       # or grab a release binary
cp examples/config.yaml /etc/prevly/config.yaml   # edit base_domain, tls
cp examples/env.example /etc/prevly/prevly.env    # fill secrets (never commit)
install -m644 packaging/prevly.service /etc/systemd/system/prevly.service
systemctl enable --now prevly
```

On first start, with no GitHub App configured, prevly serves a one-time **setup
page** on your domain: open the URL printed in the logs
(`https://<base_domain>/setup?token=…`), choose a name (and optional org), and
prevly runs GitHub's App-manifest flow for you — the App is created with the
right permissions and webhook, and its credentials are persisted under
`data_dir`. Then install the App on your repos and add a `.prevly.yml`
(`prevly init` scaffolds one; see [`examples/.prevly.yml`](./examples/.prevly.yml)).
No localhost dance, no copying secrets around.

> **Upgrading an App created before this change:** prevly now asks for
> `administration: write`, which is what GitHub requires to delete a Deployment
> environment. GitHub does not grant a new permission silently - an org owner
> must accept it from the App's settings page. Until they do, teardown still
> marks deployments inactive but every `preview/pr-<N>-<app>` environment
> survives its PR, and the repo's environment list grows without bound.

## CLI

```
prevly run       run the daemon (foreground; wrap in systemd)
prevly init      scaffold a .prevly.yml in the current repo
prevly status    list previews across repos
prevly secret    inspect the env-backed secret table
prevly destroy   admin teardown of a PR's previews
prevly doctor    check Docker access, config, disk, rootless
prevly version   version info
```

## Preview feedback

Reviewers report a problem from inside a running preview and it lands as a
comment on the pull request. Nothing is installed in the previewed app: the
daemon injects one `<script>` tag into the HTML it proxies, and the widget
talks to the daemon on the same origin under `/_prevly/`.

A small badge sits in a corner, drawn in the browser's top layer so no overlay
can bury it. Write a sentence and send, or point at the element that is wrong
and draw on the screenshot. A cross closes the badge; the shortcut brings it
back. Existing reports come back as numbered pins on the elements they were
left on.

Each report becomes one PR comment: the reviewer's words in plain sight, and
the screenshot, the console, the failed API calls and a location table folded
underneath. The table carries the selector, the XPath, the locating
attributes, the ancestors and the nearest heading, so whoever picks the report
up, a person or an agent, finds the element without guessing. Captured failed
requests carry `x-request-id`, which ties the report to the exact server log
line. No IP address is stored and the raw user agent never leaves the browser,
only a "Chrome 152 on macOS" label.

Screenshots are served from the base domain so they outlive the preview. Turn
it off host-wide with `feedback.enabled: false`, or per repo with
`feedback: false` in `.prevly.yml`. See [`docs/feedback.md`](./docs/feedback.md).

### The widget on your own environments

The in-page half is published on its own as
[`prevly-feedback-widget`](./widget), MIT, framework-free. Mount it in a
staging or demo deployment and point it at any endpoint that answers two
calls, and you get the same reporting where prevly is not the one serving the
traffic. The contract is [`docs/widget-package.md`](./docs/widget-package.md).

```ts
import { mountFeedback } from 'prevly-feedback-widget';

mountFeedback({ endpoint: '/api/feedback', reporter: { name: 'Thomas' } });
```

## Core principles

- **Single Go binary.** The daemon is also the reverse proxy and the ACME
  client (via CertMagic). Nothing else to install. Already running a
  terminating proxy? `tls.mode: external` serves cleartext on `http_addr` and
  leaves certificates to it.
- **Frontend previews against an existing backend** (not full ephemeral envs).
- **Secure by default.** Hardened containers, isolated networks, no prod secrets,
  fork-PR gating. (Rootless Docker recommended.)
- **Cloud-agnostic.** Anything with a Docker daemon: Hetzner, Scaleway, OVH,
  bare metal, a laptop. No Kubernetes, no per-cloud SDK.
- **GitHub-native UX.** Sticky PR comment + GitHub Deployments + ChatOps
  (`/preview redeploy|destroy|status`). No custom web dashboard.

## License

MIT.
