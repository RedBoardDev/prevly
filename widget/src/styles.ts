export const ACCENT = '#e11d48';

export const CSS: string = `
:host {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483647 !important;
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  pointer-events: none !important;
  visibility: visible !important;
  opacity: 1 !important;
  transform: none !important;
  filter: none !important;
  contain: style;
}
* { box-sizing: border-box; }

.root {
  --accent: ${ACCENT};
  --surface: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --line: #e2e8f0;
  --chip: #f1f5f9;
  --chip-on: #0f172a;
  --chip-on-text: #ffffff;
  --shell: #0f172a;
  --shell-text: #ffffff;
  --shadow: 0 8px 28px rgba(15, 23, 42, 0.22);
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 400;
  font-style: normal;
  letter-spacing: normal;
  text-transform: none;
  text-align: left;
  white-space: normal;
  direction: ltr;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}
.root[data-theme="dark"] {
  --surface: #1b1b1f;
  --text: #ededef;
  --muted: #9a9aa2;
  --line: #2f2f36;
  --chip: #27272d;
  --chip-on: #ededef;
  --chip-on-text: #1b1b1f;
  --shell: #101014;
  --shell-text: #ededef;
  --shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
}

/* :where keeps this reset at zero specificity: a plain \`.root button\` rule
   outranks every single-class button style below and strips their background. */
:where(.root) button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
:where(.root) button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
[hidden] { display: none !important; }

/* A popover surface inherits the UA dialog chrome; every bit of it is reset
   here, and a leftover default background paints a white box over the page. */
.top-layer {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  max-width: none;
  max-height: none;
  overflow: visible;
}
.top-layer::backdrop { background: transparent; }

.overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.badge-wrap {
  position: fixed;
  width: auto;
  height: auto;
  inset: auto;
  pointer-events: auto;
  isolation: isolate;
}
.badge-wrap[data-corner="bottom-right"] { right: 16px; bottom: 16px; }
.badge-wrap[data-corner="bottom-left"] { left: 16px; bottom: 16px; }
.badge-wrap[data-corner="top-right"] { right: 16px; top: 16px; }
.badge-wrap[data-corner="top-left"] { left: 16px; top: 16px; }
.badge-wrap[data-dragging] { transition: none; opacity: .85; }

.badge-button {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: var(--shell);
  color: var(--shell-text);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow);
  touch-action: none;
}
.badge-button:hover { transform: translateY(-1px); }
.badge-icon { display: flex; }
.badge-icon svg { width: 18px; height: 18px; display: block; }
.badge-count {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.badge-close {
  position: absolute;
  top: -6px;
  left: -6px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 90ms linear;
}
.badge-wrap:hover .badge-close,
.badge-wrap:focus-within .badge-close { opacity: 1; }
.badge-close-icon svg { width: 10px; height: 10px; display: block; }

.panel-anchor {
  position: fixed;
  inset: auto;
  width: auto;
  height: auto;
  pointer-events: auto;
}
.panel-anchor[data-corner="bottom-right"] { right: 16px; bottom: 66px; }
.panel-anchor[data-corner="bottom-left"] { left: 16px; bottom: 66px; }
.panel-anchor[data-corner="top-right"] { right: 16px; top: 66px; }
.panel-anchor[data-corner="top-left"] { left: 16px; top: 66px; }

.panel-backdrop {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.55);
  pointer-events: auto;
}

.panel {
  width: 340px;
  max-width: calc(100vw - 32px);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 12px;
  display: grid;
  gap: 8px;
}
.panel-wide { width: min(880px, 100%); max-height: 100%; overflow: auto; }
.panel-head { display: flex; align-items: center; gap: 8px; }
.panel-title { font-size: 12px; font-weight: 600; color: var(--muted); }
.icon-button {
  margin-left: auto;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-button:hover { background: var(--chip); }
.icon-button-glyph svg { width: 12px; height: 12px; display: block; }

.type-row { display: flex; gap: 4px; padding: 2px; background: var(--chip); border-radius: 8px; }
.type-option {
  flex: 1;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
.type-option[aria-checked="true"] { background: var(--chip-on); color: var(--chip-on-text); font-weight: 600; }

.field { display: grid; }
.field-input {
  font: inherit;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: var(--surface);
}
textarea.field-input { min-height: 72px; resize: vertical; }
.field-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.16); }

.author-known { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--muted); }
.link { color: var(--accent); text-decoration: underline; font-size: 12px; }

.error { color: var(--accent); font-size: 12px; min-height: 0; }
.error:empty { display: none; }

.panel-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.panel-actions .btn-ghost { margin-right: auto; white-space: nowrap; }
.send-hint { text-align: right; font-size: 11px; color: var(--muted); margin-top: -4px; }
.btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface);
  font-size: 12px;
  color: var(--text);
}
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-ghost { border-color: transparent; color: var(--muted); display: flex; align-items: center; gap: 5px; padding-left: 6px; }
.btn-ghost:hover { background: var(--chip); }
.btn-icon svg { width: 13px; height: 13px; display: block; }
.btn[disabled] { opacity: .55; cursor: default; }

.canvas-block { display: grid; gap: 8px; }
.canvas-wrap {
  background: var(--chip);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px;
  display: flex;
  justify-content: center;
}
.canvas-wrap canvas {
  max-width: 100%;
  max-height: 44vh;
  width: auto;
  height: auto;
  display: block;
  cursor: crosshair;
  touch-action: none;
  border-radius: 6px;
}
.tools { display: flex; gap: 6px; }
.tool { padding: 4px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); font-size: 12px; }
.notice {
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 12px;
}

.outline {
  position: absolute;
  border: 2px solid var(--accent);
  background: rgba(225, 29, 72, 0.08);
  border-radius: 2px;
  pointer-events: none;
  transition: all 60ms linear;
}
.outline-label {
  position: absolute;
  max-width: 320px;
  padding: 3px 7px;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.picker-hint {
  position: absolute;
  left: 50%;
  top: 16px;
  transform: translateX(-50%);
  padding: 6px 13px;
  border-radius: 999px;
  background: var(--shell);
  color: var(--shell-text);
  font-size: 12px;
  pointer-events: none;
}

.pin-container { position: absolute; inset: 0; pointer-events: none; }
.pin {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.35);
  pointer-events: auto;
}
.popover {
  position: absolute;
  width: 260px;
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: var(--shadow);
  pointer-events: auto;
}
.popover .who { font-weight: 600; }
.popover .when { color: var(--muted); font-size: 11px; margin-left: 6px; }
.popover .body { margin-top: 6px; white-space: pre-wrap; word-break: break-word; }
.popover a { color: var(--accent); font-size: 12px; display: inline-block; margin-top: 8px; }

.toast {
  position: absolute;
  max-width: 320px;
  padding: 9px 13px;
  border-radius: 10px;
  background: var(--shell);
  color: var(--shell-text);
  box-shadow: var(--shadow);
  pointer-events: auto;
}
.toast[data-corner="bottom-right"] { right: 16px; bottom: 66px; }
.toast[data-corner="bottom-left"] { left: 16px; bottom: 66px; }
.toast[data-corner="top-right"] { right: 16px; top: 66px; }
.toast[data-corner="top-left"] { left: 16px; top: 66px; }
.toast a { color: #fda4af; margin-left: 6px; }
`;
