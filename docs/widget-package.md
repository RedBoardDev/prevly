# `prevly-feedback-widget`

The in-page half of preview feedback, published on npm so anything can mount
it: prevly injects it on previews, and an application can import it to get the
same reporting on its own deployed environments.

The package knows nothing about prevly, about GitHub, or about any host
application. It collects a report and POSTs it to an endpoint it is given.

## Mounting

The package is `prevly-feedback-widget` on npm, MIT, ESM only. It ships an ESM
bundle and its `.d.ts`; prevly embeds the same source built as an IIFE that
self-mounts on `/_prevly/api/feedback` with every other option left at its
default.

```ts
import { mountFeedback } from 'prevly-feedback-widget';

const widget = mountFeedback({
  endpoint: '/_prevly/api/feedback',
  reporter: { name: 'Thomas' },
  context: { stage: 'staging' },
  labels: { send: 'Envoyer', comment: 'Que se passe-t-il ?' },
});

widget.unmount();
```

| Option | Default | Meaning |
|---|---|---|
| `endpoint` | required | Where reports are sent, and where existing ones are listed. Same origin. |
| `reporter` | `undefined` | `{ name }` when the host knows who is reporting. Undefined makes the widget ask once and remember the answer. |
| `context` | `{}` | Opaque key/value pairs echoed back in the payload. The host uses it for whatever its server needs. Values are strings, at most 10 keys, each ≤ 200 characters. |
| `labels` | English, or French on a page tagged `fr`/`fr-*` | Every visible string, so the host can translate. Picked automatically from `document.documentElement.lang` (anything else falls back to English); an explicit key here still overrides the picked locale. |
| `position` | `'bottom-right'` | Starting corner. The reviewer can drag it elsewhere and that wins. |
| `network` | `{ origins: [] }` | Origins whose failed requests are captured. Empty means the page's own origin. `network.requestIdHeader` (default `'x-request-id'`) is the response header read into the payload's `requestId` field — `x-request-id` is one API's convention, not a standard, so a host using `x-correlation-id` or `traceparent` sets this instead. The payload field stays named `requestId` regardless. |
| `theme` | `'light'` | `'light'`, `'dark'` or `'auto'` (follows the OS). |
| `types` | the three below | `Array<{ id, label }>`, 1 to 8 entries, `id` unique and matching `^[a-z0-9][a-z0-9-]{0,31}$`. Renders the panel's type selector, first entry preselected. An invalid list (bad id, empty label, duplicate, too many/none) falls back to the default instead of throwing: `bug`/`Bug`, `design`/`Design`, `question`/`Question`. |

`mountFeedback` never throws and never returns null: a browser that cannot
support it gets an inert handle. The handle also carries `open()`, which
reveals the badge (even after it was closed) and opens the panel.

## Loading as a script

The package doesn't have to be installed: prevly serves the exact same bundle,
built as an IIFE, at `/_prevly/feedback.js` — self-mounted, so nothing else is
needed. A host application (typically a [site](./feedback.md#sites)) can load
it directly instead of adding the npm dependency:

```html
<script src="https://<prevly base>/_prevly/feedback.js" data-endpoint="/api/prevly-feedback" defer></script>
```

`data-endpoint` is read once, synchronously, from the script tag itself
(`document.currentScript`, which is only non-null while the script first
executes) and must be a same-origin path starting with `/` — `//host/path` is
protocol-relative, not same-origin, and is rejected the same as any absolute
URL. Anything invalid or absent falls back to `/_prevly/api/feedback`, the
same default prevly's own injected script uses. Every other `mountFeedback`
option keeps its default.

The fetch and `XMLHttpRequest` wrappers are installed by the first
`mountFeedback` call, not by importing the package: the package declares
`sideEffects: false`, so nothing may run at import time. An embedder that wants
the failing request from before the widget mounted calls `startRecorders()`
first, which is what the IIFE build does at script start.

## What the reviewer sees

A small round badge, drawn in the browser's **top layer** through the `popover`
attribute, so nothing in the host page can cover it whatever its z-index. It
shows a count when the page carries reports. Where `popover` is unsupported
(`HTMLElement.prototype.togglePopover` is feature-detected) it falls back to a
fixed host at the maximum z-index, which an overlay of the host page can still
cover.

- Click it: a compact panel opens. Type a sentence and send. That report carries
  the page, not an element.
- "Point at something": the cursor becomes a crosshair, the hovered element is
  outlined, a click captures it and opens the same panel with a screenshot to
  draw on.
- A cross closes the badge for the current page only; nothing is
  remembered, so a reload always brings it back. There is no keyboard
  shortcut — the widget never intercepts a key combination, including the
  browser's own Ctrl/Cmd+F.
- Dragging the badge moves it; the corner is remembered per host.
- Existing reports whose element is still on the page show as numbered pins.

Sending needs one field: the sentence. The type defaults to `bug`. The reporter
name is asked once, and not at all when the host supplied one. `Ctrl`/`Cmd` plus
`Enter` sends without reaching for the button.

## What it sends

`POST <endpoint>`, `multipart/form-data`:

- `meta`: JSON, `application/json`, ≤ 64 KiB
- `screenshot`: PNG, ≤ 3 MiB, absent for a report that points at nothing

```jsonc
{
  "type": "bug",                      // any configured type id, "bug" when absent
  "comment": "The total is wrong",    // 1..4000, the only required field
  "author": "Jordan",                 // reporter.name when the host supplies one, asked once otherwise
  "page": "/cart/123?promo=save10",   // starts with "/", ≤ 2000
  "title": "Checkout – Acme Shop",    // document.title, ≤ 200
  "context": { "stage": "staging" },  // echoed from the options
  "selector": "main td.total",        // absent for a page-level report
  "element": {                        // absent for a page-level report
    "tag": "td",
    "text": "$1,234.00",
    "xpath": "/html/body/main/table/tbody/tr[3]/td[4]",
    "attrs": { "id": "grand-total" }, // locating attributes only, never `value`
    "classes": ["total"],
    "ancestors": ["main#cart", "table.line-items"],
    "heading": "Order summary"
  },
  "click": { "x": 812, "y": 403 },
  "rect": { "x": 780, "y": 390, "w": 96, "h": 28 },
  "viewport": { "w": 1440, "h": 900, "dpr": 2 },
  "client": "Chrome 152 on macOS",    // coarse label, never the raw user agent
  "console": [ { "level": "error", "message": "…", "at": "…" } ],
  "network": [                        // see the bounds below
    { "method": "GET", "path": "/api/v1/cart/123", "status": 500,
      "requestId": "req-9f2c", "at": "2026-09-28T09:12:33Z" }
  ]
}
```

`GET <endpoint>` returns `{"items": [...]}`, newest first, used to draw the pins.
Each item needs at least `id`, `page`, `selector`, `author`, `comment`,
`created_at` and may carry `url` to link the report where it landed.

## Locked

The package knows nothing about prevly or any particular gating scheme, but
it defines one generic rule any server can opt into: **a `401` on `GET
<endpoint>` means the widget is locked.** The badge still renders and still
counts existing pins it can see, but opening it shows `labels.locked` instead
of the report form — there is nothing to submit until the host lets this
viewer in. A `401` on `POST <endpoint>` switches to the same locked state,
for the case where access was revoked between the last list and this submit.

A `404` on `GET <endpoint>` is a different thing entirely and is *not*
locked: it means the server has no list route at all (no backing store,
feedback turned off), so the widget draws no pins and still lets a report be
posted. Any other status while listing is treated as "no items yet", not
locked.

`labels.locked` defaults to *"Open this preview from the link in the pull
request to send feedback."* — a host embedding the package for its own
authenticated environment gives it whatever text fits how access there works.

## Network capture bounds

Deliberately narrow, because a report full of ordinary 401s and blocked
analytics calls sends whoever reads it after ghosts.

- Only requests to the configured origins, defaulting to the page's own. Nothing
  third-party.
- Only status `>= 500`, and requests that never completed at all — except one
  the application itself cancelled (`AbortError`, including a `DOMException`
  carrying that name): a fast client-side navigation aborts its own pending
  fetches constantly, and none of those are a failure worth reporting.
- The path only, query string dropped. Never a body, never a header other than
  `x-request-id` when the server exposes it.
- At most 5 entries, each path ≤ 200 characters.

`x-request-id` is the point of the whole thing: it ties the report to the exact
server log line.

## Privacy

No IP address is read. The raw user agent never leaves the page; the widget
derives a browser and platform label and sends that. Captured attributes are an
allowlist of locating attributes and exclude `value`, so nothing typed by the
reviewer is collected. Generated ids, hashed CSS-module classes and pointer or
focus state attributes are rejected: they look like locators while matching
nothing on the next load.

## What a server must do

Nothing beyond answering those two calls, with one rule that matters.

**A server that already knows who is calling must ignore `author`.** It comes
from the page and anyone can put anything in it. When the host authenticates
its reviewers, the identity is the session's, and `author` is at best a hint.
prevly itself has no session on a preview, so it trusts the field; an
application behind a login must not.

prevly turns a report into a comment on the
pull request that owns the preview. An application can turn it into an issue, a
ticket, a row in a table. The widget does not care.
