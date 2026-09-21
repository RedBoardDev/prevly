type Child = Node | string | null | undefined | false;

export interface ElProps {
  class?: string;
  text?: string;
  html?: string;
  style?: Partial<CSSStyleDeclaration>;
  attrs?: Record<string, string>;
  on?: Record<string, EventListener>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.html !== undefined) node.innerHTML = props.html;
  if (props.style) Object.assign(node.style, props.style);
  if (props.attrs) {
    for (const [name, value] of Object.entries(props.attrs)) node.setAttribute(name, value);
  }
  if (props.on) {
    for (const [name, listener] of Object.entries(props.on)) node.addEventListener(name, listener);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

export function button(label: string, ariaLabel: string, onClick: () => void, cls = ''): HTMLButtonElement {
  return el(
    'button',
    {
      class: cls,
      text: label,
      attrs: { type: 'button', 'aria-label': ariaLabel },
      on: { click: () => onClick() },
    },
  );
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
