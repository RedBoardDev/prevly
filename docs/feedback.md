# Preview feedback

Reviewers annotate a running preview and the annotation lands as a comment on
the pull request that owns the preview. Nothing is installed in the previewed
app: the daemon injects one `<script>` tag into every HTML page it proxies, and
the script talks to the daemon on the same origin.

## Flow

```
browser ── GET https://pr-42-rs.<base>/reports ──▶ proxy ──▶ container
        ◀── HTML + <script src="/_prevly/feedback.js" defer> ◀──┘   (injected)
browser ── GET  /_prevly/feedback.js          ──▶ daemon (embedded asset)
browser ── GET  /_prevly/api/feedback         ──▶ daemon: pins for this host
browser ── POST /_prevly/api/feedback         ──▶ daemon: store + PR comment
GitHub  ── GET  https://<base>/_prevly/feedback/<id>/screenshot.png (camo fetch)
```

The widget is on wherever the daemon injects it. There is no activation step:
`feedback.enabled` on the host and `feedback` in `.prevly.yml` are the only
switches. The badge carries a cross that closes it; the choice is remembered
per host in `localStorage` and `Ctrl`/`Cmd` + `F` brings it back, straight into
a report.

## Routing on a preview host

Every request whose path starts with `/_prevly/` is answered by the daemon and
never reaches the container. It does not wake a sleeping preview.

| Method | Path | Answer |
|---|---|---|
| GET | `/_prevly/feedback.js` | the widget bundle, `application/javascript`, `Cache-Control: no-cache` |
| GET | `/_prevly/api/feedback` | `200 {"items":[Feedback…]}` for this host, newest first, no binary |
| POST | `/_prevly/api/feedback` | multipart, see below. `201 {"item":Feedback}` |
| GET | `/_prevly/feedback/{id}/screenshot.png` | `image/png`, immutable cache |
| anything else | `/_prevly/*` | `404` |

The same `/_prevly/feedback/{id}/screenshot.png` and `/_prevly/feedback.js`
are also served on the base domain (`https://<base>/…`): the PR comment
references the screenshot there so the image outlives the preview.

Unknown host (no preview in the store) → `404` as today.

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
| `type` | `bug`, `design` or `question`; `bug` when absent |
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
  "repo": "akord-securite/KARE",
  "pr": 1268,
  "app": "kare",
  "type": "bug",
  "page": "/reports/123?tab=costs",
  "author": "Thomas",
  "comment": "The total is wrong",
  "selector": "…", "element": {…}, "click": {…}, "rect": {…},   // as posted
  "viewport": {…},
  "created_at": "2026-09-21T10:12:40Z",
  "comment_url": "https://github.com/akord-securite/KARE/pull/1268#issuecomment-123", // or null
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
### 🐞 Bug · Thomas · `kare` · [/reports/123?tab=costs](<https://pr-1268-rs.<base>/reports/123?tab=costs>)

> The total is wrong

<details><summary>Screenshot</summary>

![screenshot](https://<base>/_prevly/feedback/01J8…/screenshot.png)

</details>

<details><summary>Where exactly</summary>

| | |
|---|---|
| URL | <https://pr-1268-rs.<base>/reports/123?tab=costs> |
| App | `kare` |
| stage | `staging` |
| Section | Détail des prestations |
| CSS selector | `main > table tr:nth-child(3) td.total` |
| Element | `<td>` |
| Element text | "1 234,00 €" |
| Attributes | `id="grand-total"` |
| Ancestors | `main#report > table.prestations > tbody > tr` |
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
2026-09-21T10:12:33Z GET /rs/v1/reports/123 500 x-request-id=req-9f2c
```

</details>
```

Only the heading and the reviewer's own words are visible. The screenshot, the
location table, the console and the network are folded, so a pull request
collecting a dozen reports stays readable.

Nothing is added to the sticky comment: the widget is already there.

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

Teardown of a preview deletes its feedback records; screenshot files stay
until `feedback.retention` (default `90d`) elapses, swept by the reconcile
loop.

## Host config

```yaml
feedback:
  enabled: true        # default true; false disables injection and the API
  retention: 90d       # screenshot files
  max_per_hour: 30     # POSTs per preview host
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

The proxy also drops `Accept-Encoding` on outbound requests that accept
`text/html`, so injected responses are never compressed; `Content-Length` is
recomputed and `Content-Encoding` removed when a body is rewritten. Responses
above 8 MiB are passed through untouched. Streaming is lost for injected
responses (buffered), accepted for previews.

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

Wired in `cmd/prevly/run.go` by the feedback task.
