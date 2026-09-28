# prevly-feedback-widget

The in-page half of preview feedback. A reviewer clicks a small badge, writes one
sentence and it is POSTed to an endpoint you choose. Optionally they point at an
element first and draw on a screenshot of it.

The package knows nothing about prevly, about GitHub, or about any host
application.

```bash
npm install prevly-feedback-widget
```

```ts
import { mountFeedback } from 'prevly-feedback-widget';

const widget = mountFeedback({
  endpoint: '/api/feedback',
  reporter: { name: 'Thomas' },
  context: { stage: 'staging' },
  labels: { send: 'Envoyer' },
});

widget.unmount();
```

| Option | Default | Meaning |
|---|---|---|
| `endpoint` | required | Where reports are sent, and where existing ones are listed. Same origin. |
| `reporter` | `undefined` | `{ name }` when the host knows who is reporting. Undefined makes the widget ask once and remember the answer. |
| `context` | `{}` | Opaque string key/value pairs echoed back in the payload. At most 10 keys, each key and value ≤ 200 characters. |
| `labels` | English | Every visible string, so the host can translate. |
| `position` | `'bottom-right'` | Starting corner. The reviewer can drag it elsewhere and that wins. |
| `shortcut` | `'f'` | Pressed with the platform modifier, starts a report. It also brings the badge back after it was closed. |
| `network` | `{ origins: [] }` | Origins whose failed requests are captured. Empty means the page's own origin. |
| `theme` | `'auto'` | `auto`, `light` or `dark`. |

`mountFeedback` never throws and never returns null: a browser that cannot
support it gets an inert handle.

The badge and every panel are drawn in the browser's top layer through the
`popover` attribute, so nothing in the host page can cover them.

The full contract — payload shape, network capture bounds, privacy — lives in
[`docs/widget-package.md`](https://github.com/RedBoardDev/prevly/blob/main/docs/widget-package.md).

MIT.
