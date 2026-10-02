# Preview feedback

Reviewers annotate a running preview and the annotation lands as a comment on
the pull request that owns the preview. Nothing is installed in the previewed
app: the daemon injects one `<script>` tag into every HTML page it proxies, and
the script talks to the daemon on the same origin.

## Flow

```
browser ── GET https://pr-42-web.<base>/cart ──▶ proxy ──▶ container
        ◀── HTML + <script src="/_prevly/feedback.js" defer> ◀──┘   (injected)
browser ── GET  /_prevly/feedback.js          ──▶ daemon (embedded asset, public)
browser ── GET  /_prevly/activate?t=<token>   ──▶ daemon: sets the feedback cookie
browser ── GET  /_prevly/api/feedback         ──▶ daemon: pins for this host (cookie required)
browser ── POST /_prevly/api/feedback         ──▶ daemon: store + PR comment (cookie required)
GitHub  ── GET  https://<base>/_prevly/feedback/<id>/screenshot.png (camo fetch, public)
```

The widget is on wherever the daemon injects it, on every preview, because
previews are public: anyone who guesses a preview URL can otherwise post to
the pull request's comments, with any `author` they like, and read every
report's author and comment. Reading and writing feedback is gated by a
per-preview secret instead: `feedback.enabled` on the host and `feedback` in
`.prevly.yml` still switch injection off entirely, but a repo that has
feedback on still requires the activation link.

**Activation.** `model.Preview.FeedbackToken` is 32 random bytes
(`crypto/rand`, base64url, no padding), generated once at deploy and kept
stable across redeploys — the link already posted to the pull request keeps
working. The sticky comment's app row carries it next to `[open](url)`:
`[send feedback](<preview-url>/_prevly/activate?t=<token>)`. Visiting it
compares `t` to the preview's token in constant time
(`crypto/subtle.ConstantTimeCompare`) and, on a match, sets

```
Set-Cookie: prevly_feedback=<token>; Path=/_prevly/; HttpOnly; Secure; SameSite=Strict; Max-Age=<preview TTL or 30d>
```

then 302s to `/`. `Path=/_prevly/` is deliberate: the previewed application
never receives the cookie, and `HttpOnly` keeps its scripts from reading it. A
wrong or missing token, or an unknown host, all answer `404`, identical to any
other unknown `/_prevly/` path — the endpoint never reveals which case it was.
The token itself is never logged, not even truncated.

`GET`/`POST /_prevly/api/feedback` require that cookie, compared the same
constant-time way; missing or wrong answers `401` with a JSON error. Nothing
else changes: `GET /_prevly/feedback.js` and both screenshot routes stay
public, because the badge must still render for an unactivated visitor and
GitHub's image proxy never carries the cookie. The existing per-host rate
limit still applies, as defence in depth.

**Existing previews have no token.** A record written before the field
existed decodes to `FeedbackToken == ""`. The reconcile loop's tick backfills
it: for every running or sleeping preview with feedback on and an empty
token, it generates one, persists it, and republishes the sticky comment once
so the activation link appears — the same care `FeedbackEnabled` already
needed, since a plain `bool` added the same way once silently turned feedback
off for every live preview instead of reading its zero value as "unset".

The badge carries a cross that closes it for the current page only — nothing
is persisted, so a reload always brings it back; there is no keyboard
shortcut to do it another way. The widget package itself knows nothing about
any of this: from its point of
view a `401` on its configured endpoint means *locked*, full stop — see
[`widget-package.md`](./widget-package.md#locked).

## Routing on a preview host

Every request whose path starts with `/_prevly/` is answered by the daemon and
never reaches the container. It does not wake a sleeping preview.

| Method | Path | Auth | Answer |
|---|---|---|---|
| GET | `/_prevly/feedback.js` | public | the widget bundle, `application/javascript`, `Cache-Control: no-cache` |
| GET | `/_prevly/activate?t=<token>` | token in the query | sets the feedback cookie, `302` to `/`; `404` on a mismatch |
| GET | `/_prevly/api/feedback` | `prevly_feedback` cookie | `200 {"items":[Feedback…]}` for this host, newest first, no binary; `401` without the cookie |
| POST | `/_prevly/api/feedback` | `prevly_feedback` cookie | multipart, see below. `201 {"item":Feedback}`; `401` without the cookie |
| GET | `/_prevly/feedback/{id}/screenshot.png` | public | `image/png`, cache bounded by the retention sweep (below) |
| anything else | `/_prevly/*` | — | `404` |

The same `/_prevly/feedback/{id}/screenshot.png` and `/_prevly/feedback.js`
are also served on the base domain (`https://<base>/…`): the PR comment
references the screenshot there so the image outlives the preview.

Unknown host (no preview in the store) → `404` as today. A screenshot's
`Cache-Control` carries `max-age` set to the seconds left before the file's
mtime plus `feedback.retention` — never `immutable` — so a client or GitHub's
image proxy cannot keep serving an image for longer than the sweep keeps the
file on disk.

## POST /_prevly/api/feedback

`multipart/form-data`, a `meta` JSON part and an optional `screenshot` PNG part.
The shape of `meta` is the widget's contract and lives in one place only,
[`widget-package.md`](./widget-package.md#what-it-sends). Restating it here
would give two copies, and the one that drifts is the one that misleads.

What this server adds on top of that shape are the bounds it enforces and the
answers it gives. A payload outside a bound is rejected whole, never truncated.

| | |
|---|---|
| `meta` part | ≤ 64 KiB |
| `screenshot` part | ≤ 3 MiB, PNG, optional |
| `comment` | 1..4000, the only required field |
| `author` | 1..80, required |
| `type` | any id matching `^[a-z0-9][a-z0-9-]{0,31}$`; `bug` when absent |
| `page` | starts with `/`, ≤ 2048 |
| `title`, `element.text`, `element.heading` | ≤ 200, ≤ 120, ≤ 120 |
| `selector`, `element.xpath` | ≤ 500 |
| `element.attrs` | ≤ 16 entries, values ≤ 80 |
| `element.classes`, `element.ancestors` | ≤ 8 entries, each ≤ 80 |
| `client` | ≤ 80 |
| `console` | ≤ 20 entries, message ≤ 500 |
| `context` | ≤ 10 keys, keys and values ≤ 200 |
| `network` | ≤ 5 entries, path ≤ 200 |

Responses: `201` with the stored item; `400` on invalid meta or oversize parts;
`404` unknown host; `415` wrong content type; `429` over the per-host rate
limit (`Retry-After` set). The GitHub comment is posted synchronously with a
10 s budget; if it fails the item is still stored with `comment_url: null`
and the reconcile loop retries it on its next tick.

## Feedback (JSON shape returned by the API)

```jsonc
{
  "id": "01J8…",                    // time-ordered, URL-safe, unique
  "repo": "acme/shop",
  "pr": 1268,
  "app": "web",
  "type": "bug",
  "page": "/cart/123?promo=save10",
  "author": "Jordan",
  "comment": "The total is wrong",
  "selector": "…", "element": {…}, "click": {…}, "rect": {…},   // as posted
  "viewport": {…},
  "created_at": "2026-09-21T10:12:40Z",
  "comment_url": "https://github.com/acme/shop/pull/1268#issuecomment-123", // or null
  "screenshot_url": "https://<base>/_prevly/feedback/01J8…/screenshot.png" // or null
}
```

`client`, `console`, `context` and `network` are stored and rendered in the PR
comment; only `type` of the four is returned by the list endpoint. No IP address is ever read or stored, and the
raw user agent never leaves the browser: the widget derives a browser and
platform label from it and sends only that.

`<!--` and `-->` in reviewer-supplied text are escaped before rendering: a body
containing `<!-- prevly -->` would otherwise be found by the sticky-comment
lookup and overwritten on the next status update.

## PR comment

One plain comment per feedback (never the sticky one), authored by the App.

```markdown
<!-- prevly-feedback:01J8… -->
### 🐞 Bug · Jordan · `web` · [/cart/123?promo=save10](<https://pr-1268-web.<base>/cart/123?promo=save10>)

> The total is wrong

<details><summary>Screenshot</summary>

![screenshot](https://<base>/_prevly/feedback/01J8…/screenshot.png)

</details>

<details><summary>Where exactly</summary>

| | |
|---|---|
| URL | <https://pr-1268-web.<base>/cart/123?promo=save10> |
| App | `web` |
| stage | `staging` |
| Section | Order summary |
| CSS selector | `main > table tr:nth-child(3) td.total` |
| Element | `<td>` |
| Element text | "$1,234.00" |
| Attributes | `id="grand-total"` |
| Ancestors | `main#cart > table.line-items > tbody > tr` |
| XPath | `/html/body/main/table/tbody/tr[3]/td[4]` |
| Clicked at | x 812, y 403 in the viewport |
| Viewport | 1440×900 @2x |
| Commit | `abc1234` |
| Browser | Chrome 152 on macOS |
| Reported | 2026-09-21 10:12 UTC |
</details>

<details><summary>Console (2 errors)</summary>

```
2026-09-21T10:12:33Z error TypeError: …
```

</details>

<details><summary>Network (1 failed request)</summary>

```
2026-09-21T10:12:33Z GET /api/v1/cart/123 500 x-request-id=req-9f2c
```

</details>
```

Only the heading and the reviewer's own words are visible. The screenshot, the
location table, the console and the network are folded, so a pull request
collecting a dozen reports stays readable.

`bug`, `improvement` and `question` keep their own glyph and name (🐞/💡/❓); any
other configured type id gets one neutral glyph (🏷️) and its id, capitalized
and de-hyphenated (`feature-request` → "Feature Request") — sanitized like any
other reviewer-supplied text, since the id travels from the client.

Nothing is added to the sticky comment: the widget is already there.

## Sites

Not every environment is a preview: a staging or a demo runs continuously and
prevly does not proxy it. A site's own application mounts the widget itself
and relays each report to prevly **server-side**; prevly turns it into a
**GitHub issue** instead of a PR comment. Nobody performs an activation step —
the gate is a shared secret only the site's own server knows.

### Config

```yaml
feedback:
  sites:
    - name: staging                 # ^[a-z0-9][a-z0-9-]{0,31}$, unique
      repo: acme/shop               # owner/name
      labels: [feedback/staging]    # optional
      issue_type: Draft             # optional GitHub issue type
      key_env: PREVLY_SITE_STAGING_KEY   # env var holding the shared secret
      type_label: false             # optional, also label the issue with the report type
```

`key_env` never holds the secret inline: it names the environment variable the
daemon reads it from at startup. A configured site whose env var is empty or
shorter than 32 characters is a fatal error at daemon start, naming the
variable and never its value.

### Route

`POST https://<base>/_prevly/sites/<site>/api/feedback` on the base domain,
the same multipart body, bounds and validation as a preview's
`POST /_prevly/api/feedback` (see above). `GET` on the same path always
answers 404 — a site has no pin list, which the widget contract reads as "no
pins, not locked", not as "locked".

Auth is the `X-Prevly-Site-Key` header, compared to the site's secret in
constant time. An unknown site, a missing key and a wrong key all answer the
same 404, so the endpoint reveals nothing to a guess; a wrong key is logged
with the site's name only, never the key. The existing per-host rate limit
applies, keyed per site.

### What the host application must do

Relay the widget's POST **server-side**, adding the header: the shared secret
must never reach the browser.

```ts
// app/api/prevly-feedback/route.ts (Next.js route handler)
export async function POST(request: Request) {
  const upstream = await fetch('https://<prevly base>/_prevly/sites/staging/api/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('content-type') ?? '',
      'X-Prevly-Site-Key': process.env.PREVLY_SITE_STAGING_KEY!,
    },
    body: request.body,
    duplex: 'half',
  });
  return new Response(upstream.body, { status: upstream.status });
}
```

Load the widget from prevly as a plain script pointed at that relay — no npm
dependency required (see
[`widget-package.md`](./widget-package.md#loading-as-a-script)):

```html
<script src="https://<prevly base>/_prevly/feedback.js" data-endpoint="/api/prevly-feedback" defer></script>
```

or, mounting it programmatically instead:

```ts
import { mountFeedback } from 'prevly-feedback-widget';

mountFeedback({ endpoint: '/api/prevly-feedback' });
```

prevly has no session on a site and trusts `author` as posted, exactly as it
does on a preview; a site behind a login should supply `reporter: { name }`
so the widget never asks.

### Issue body

Same compact, folded layout as a PR comment: the reviewer's words above the
fold, screenshot, location table, console and network folded below it. Since a
site is reachable by anyone who can reach the host application — never gated
by an activation link the way a preview is — **every reviewer-supplied string
is made inert** before it enters markdown: an `@mention`, a bare `#123`
reference, `GH-123` and `owner/repo#123` are all broken with a zero-width
space, `![` becomes `!` + zero-width space + `[`, and `<`/`>` are escaped. The
title is the report type followed by the comment's first line, at most 80
characters, made inert the same way: `Bug: the total is wrong`.

Labels are the site's configured `labels`, plus the report's `type` when the
site sets `type_label: true`. It is off by default because the type already
leads the title, and a bare `bug` label would mix widget reports with a team's
own bugs. The GitHub issue type is the site's `issue_type` when configured.

To tell apps apart, declare one site per application, each with its own
`labels` (for instance `[source:feedback, area:web]`). Several sites may share
one `key_env`. GitHub silently drops
labels or the type when the App lacks push access on the repo — the issue is
still created, and the daemon logs an error naming what was dropped. A
400/422 caused by the type field is retried once without it; a
401/403/404/429 is never retried.

Retrying a report that timed out reuses the issue it already created: the
body carries `<!-- prevly-site-report:<id> -->`, and a retry looks for that
marker via the strongly-consistent issue list — never the search API, whose
index lags too far behind a retry that follows a timeout by seconds — before
creating a new one.

### Retention

A site report has no teardown to delete it on, unlike a preview's: the
reconcile tick deletes site records (and their screenshot file) once they
pass `feedback.retention`, the same window a preview's screenshots use.

## Storage

bbolt bucket `feedback`, key `<repo>#<pr>#<app>#<id>` (id is Crockford base32
of a 6-byte millisecond timestamp + 10 random bytes, so keys sort by age), JSON
value (the full
record incl. client/console/context/network, plus `comment_id`, `installation_id`, `host`,
`commit_sha`, `screenshot` bool). Screenshots on disk:
`<data_dir>/feedback/<id>.png`.

`Preview.feedback_enabled` is a nullable bool read through `FeedbackOn()`:
unset means on, matching the `.prevly.yml` default, so a preview stored before
the field existed keeps serving the widget.

`Preview.feedback_token` gates the feedback API and the activation link (see
above): generated once at deploy, kept stable across redeploys, destroyed with
the preview. A record stored before the field existed decodes to `""` until
the reconcile loop's tick backfills it.

Teardown of a preview deletes its feedback records; screenshot files stay
until `feedback.retention` (default `90d`) elapses, swept by the reconcile
loop.

## Host config

```yaml
feedback:
  enabled: true        # default true; false disables injection and the API
  retention: 90d       # screenshot files, and site reports (see Sites)
  max_per_hour: 30     # POSTs per preview host, or per site
  sites: []            # long-lived, non-preview environments — see Sites, above
```

Repo config (`.prevly.yml`): `feedback: false` opts a repo out (default true).

## Go seams

`internal/ingress` (owned by the ingress task):

```go
// Injector decides what to inject for a preview host. tag is inserted before
// </body> (or appended when absent) into text/html 200 responses. ok=false
// means leave the response untouched.
type Injector interface{ InjectTag(host string) (tag string, ok bool) }
func (p *Proxy) SetInjector(i Injector)

// SetPreviewPathHandler routes requests on preview hosts whose path starts with
// prefix to h, before resolving (and so without waking) the upstream. The
// request reaches h unchanged (Host header = preview host).
func (p *Proxy) SetPreviewPathHandler(prefix string, h http.Handler)
```

The proxy also drops `Accept-Encoding` on outbound requests whose `Accept`
explicitly names `text/html` — what a navigation sends — so injected responses
are never compressed; `Content-Length` is recomputed and `Content-Encoding`
removed when a body is rewritten. An empty `Accept` or `*/*` (what scripts and
a default `fetch` send) does *not* count: treating them as HTML made every JS
chunk and API response on a preview travel uncompressed too. Responses above
8 MiB are passed through untouched. Streaming is lost for injected responses
(buffered), accepted for previews.

`internal/feedback` (owned by the feedback task) exposes:

```go
type Service struct{…}
func New(deps Deps) *Service           // store, GitHub poster, config, base domain, logger, data dir
func (s *Service) InjectTag(host string) (string, bool)   // implements ingress.Injector
func (s *Service) PreviewHandler() http.Handler            // for SetPreviewPathHandler("/_prevly/")
func (s *Service) ControlHandler() http.Handler            // mounted under /_prevly/ on the base domain
func (s *Service) OnTeardown(repo string, pr int, app string) error
func (s *Service) Tick(ctx context.Context)                // retry unposted comments, sweep screenshots
```

A comment is retried at most 5 times (`post_attempts` on the record). The repo
opt-in is snapshotted on the preview record (`model.Preview.FeedbackEnabled`) at
deploy time, so serving a request never re-fetches `.prevly.yml`.

`internal/reconcile` takes the two hooks through `Deps`:
`OnTeardown func(repo string, pr int, app string)` (called from
`teardownPreview`) and `FeedbackTick func(ctx context.Context)` (called at the
end of each loop tick).

The reconciler itself owns the token: `upsertBuilding` (deploy) generates
`FeedbackToken` when empty, and the loop's own `backfillFeedbackToken`, called
once per preview per tick, does the same for a preview stored before the
field existed and republishes the sticky comment through the existing
`publish`/`updateComment` path.

Wired in `cmd/prevly/run.go` by the feedback task.
