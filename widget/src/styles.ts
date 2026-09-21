export const ACCENT = '#e11d48';

export const CSS = `
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
  contain: layout style;
}
:host([data-prevly-hidden]) { display: none !important; }
* { box-sizing: border-box; }
.root {
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
  color: #0f172a;
  -webkit-font-smoothing: antialiased;
}
.root button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
.root button:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }

.launcher {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: #0f172a;
  color: #fff;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.35);
  pointer-events: auto;
}
.launcher:hover { background: #1e293b; }
.launcher .badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: ${ACCENT};
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.launcher .badge[hidden] { display: none; }

.menu {
  position: absolute;
  right: 16px;
  bottom: 76px;
  width: 292px;
  max-height: 60vh;
  overflow: auto;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.22);
  padding: 6px;
  pointer-events: auto;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  text-align: left;
}
.menu-item:hover { background: #f1f5f9; }
.menu-item .hint { margin-left: auto; color: #64748b; font-size: 12px; }
.menu-sep { height: 1px; margin: 6px 4px; background: #e2e8f0; }
.menu-title { padding: 6px 10px 2px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.menu-orphan { padding: 6px 10px; color: #475569; font-size: 12px; }
.menu-orphan b { color: #0f172a; font-weight: 600; }

.outline {
  position: absolute;
  border: 2px solid ${ACCENT};
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
  background: ${ACCENT};
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
  padding: 7px 14px;
  border-radius: 999px;
  background: #0f172a;
  color: #fff;
  font-size: 12px;
  pointer-events: none;
}

.pin {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: ${ACCENT};
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
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.2);
  pointer-events: auto;
}
.popover .who { font-weight: 600; }
.popover .when { color: #64748b; font-size: 11px; margin-left: 6px; }
.popover .body { margin-top: 6px; white-space: pre-wrap; word-break: break-word; }
.popover a { color: ${ACCENT}; font-size: 12px; display: inline-block; margin-top: 8px; }

.backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  pointer-events: auto;
}
.modal {
  width: min(900px, 100%);
  max-height: 100%;
  overflow: auto;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.4);
  padding: 16px;
}
.modal h2 { margin: 0 0 10px; font-size: 15px; font-weight: 600; }
.canvas-wrap {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 8px;
  display: flex;
  justify-content: center;
}
.canvas-wrap canvas {
  max-width: 100%;
  max-height: 46vh;
  width: auto;
  height: auto;
  display: block;
  cursor: crosshair;
  touch-action: none;
  border-radius: 6px;
}
.notice {
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 12px;
}
.tools { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
.tool {
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
  font-size: 12px;
}
.tool[aria-pressed="true"] { border-color: ${ACCENT}; color: ${ACCENT}; background: #fff1f2; }
.fields { display: grid; gap: 8px; }
.fields label { font-size: 12px; color: #475569; display: grid; gap: 4px; }
.fields textarea, .fields input {
  font: inherit;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #0f172a;
  background: #fff;
}
.fields textarea { min-height: 76px; resize: vertical; }
.fields textarea:focus, .fields input:focus { outline: 2px solid ${ACCENT}; outline-offset: 0; border-color: ${ACCENT}; }
.error { color: ${ACCENT}; font-size: 12px; min-height: 16px; }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
.btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  font-size: 13px;
}
.btn-primary { background: ${ACCENT}; border-color: ${ACCENT}; color: #fff; }
.btn[disabled] { opacity: .55; cursor: default; }

.toast {
  position: absolute;
  right: 16px;
  bottom: 76px;
  max-width: 320px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #0f172a;
  color: #fff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.35);
  pointer-events: auto;
}
.toast a { color: #fda4af; margin-left: 6px; }
[hidden] { display: none !important; }
`;
