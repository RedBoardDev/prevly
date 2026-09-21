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
switches. The menu has "Hide until reload", which unmounts it for the current
page only, the way a framework's dev indicator behaves; the next page load
brings it back.

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

`multipart/form-data` with two parts:

- `meta`: JSON, `application/json`, ≤ 64 KiB
- `screenshot`: PNG, ≤ 3 MiB, optional (a report without image is valid)

```jsonc
// meta
{
  "author": "Thomas",                 // 1..80 chars, required
  "comment": "The total is wrong",    // 1..4000 chars, required
  "page": "/reports/123?tab=costs",   // path + query of the page, required, must start with "/", <= 2048
  "title": "Report – KARE",           // document.title, ≤ 200
  "selector": "main > table tr:nth-child(3) td.total",  // ≤ 500, optional
  "element": {                        // optional, everything needed to find it again
    "tag": "td",
    "text": "1 234,00 €",             // ≤ 120
    "xpath": "/html/body/main/table/tbody/tr[3]/td[4]",
    "attrs": { "id": "grand-total" }, // allowlisted locating attributes only, never `value`
    "classes": ["total"],             // ≤ 8, each ≤ 80
    "ancestors": ["main#report", "table.prestations"], // ≤ 8
    "heading": "Détail des prestations"
  },
  "click": { "x": 812, "y": 403 },    // viewport coords of the click, optional
  "rect":  { "x": 780, "y": 390, "w": 96, "h": 28 },     // element rect in viewport, optional
  "viewport": { "w": 1440, "h": 900, "dpr": 2 },
  "client": "Chrome 152 on macOS",    // coarse label, never the raw user agent, ≤ 80
  "console": [                        // ≤ 20 entries, each message ≤ 500 chars
    { "level": "error", "message": "TypeError: …", "at": "2026-09-21T10:12:33Z" }
  ]
}
```

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

`client` and `console` are stored and rendered in the PR comment but not
returned by the list endpoint. No IP address is ever read or stored, and the
raw user agent never leaves the browser: the widget derives a browser and
platform label from it and sends only that.

`<!--` and `-->` in reviewer-supplied text are escaped before rendering: a body
containing `<!-- prevly -->` would otherwise be found by the sticky-comment
lookup and overwritten on the next status update.

## PR comment

One plain comment per feedback (never the sticky one), authored by the App.

```markdown
<!-- prevly-feedback:01J8… -->
### 💬 Thomas · `kare` · [/reports/123?tab=costs](<https://pr-1268-rs.<base>/reports/123?tab=costs>)

> The total is wrong

<details><summary>Screenshot</summary>

![screenshot](https://<base>/_prevly/feedback/01J8…/screenshot.png)

</details>

<details><summary>Where exactly</summary>

| | |
|---|---|
| URL | <https://pr-1268-rs.<base>/reports/123?tab=costs> |
| App | `kare` |
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
```

Only the heading and the reviewer's own words are visible. The screenshot, the
location table and the console are folded, so a pull request collecting a dozen
reports stays readable.
2026-09-21T10:12:33Z error TypeError: …
```
</details>
```

Nothing is added to the sticky comment: the widget is already there.

## Storage

bbolt bucket `feedback`, key `<repo>#<pr>#<app>#<id>` (id is Crockford base32
of a 6-byte millisecond timestamp + 10 random bytes, so keys sort by age), JSON
value (the full
record incl. client/console, plus `comment_id`, `installation_id`, `host`,
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
