import { LIMITS, clamp } from './limits';
import { isStableAttr, isStableName } from './stability';

// Only attributes that help locate an element are sent. `value` and friends are
// deliberately absent: a report must never carry what the reviewer typed.
const USEFUL_ATTRS = [
  'id',
  'name',
  'type',
  'role',
  'aria-label',
  'title',
  'alt',
  'placeholder',
  'data-testid',
  'data-test',
  'data-cy',
  'data-qa',
  'data-slot',
  'data-key',
  'href',
];

export interface TargetDescription {
  tag: string;
  text: string;
  xpath: string | null;
  attrs: Record<string, string>;
  classes: string[];
  ancestors: string[];
  heading: string | null;
}

export function describeTarget(el: Element, text: string): TargetDescription {
  return {
    tag: el.tagName.toLowerCase(),
    text,
    xpath: xpathOf(el),
    attrs: usefulAttrs(el),
    classes: stableClasses(el),
    ancestors: ancestorTrail(el),
    heading: nearestHeading(el),
  };
}

function usefulAttrs(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of USEFUL_ATTRS) {
    const value = el.getAttribute(name)?.trim();
    if (value && isStableAttr(name, value)) out[name] = clamp(value, LIMITS.attrValue);
  }
  return out;
}

function stableClasses(el: Element): string[] {
  const raw = typeof el.className === 'string' ? el.className : '';
  return raw
    .trim()
    .split(/\s+/)
    .filter(isStableName)
    .slice(0, LIMITS.classes)
    .map((name) => clamp(name, LIMITS.attrValue));
}

export function xpathOf(el: Element): string | null {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1) {
    const parent: Element | null = node.parentElement;
    const tag = node.tagName.toLowerCase();
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const siblings = Array.prototype.filter.call(
      parent.children,
      (child: Element) => child.tagName === node?.tagName,
    ) as Element[];
    const index = siblings.indexOf(node) + 1;
    parts.unshift(siblings.length > 1 ? `${tag}[${index}]` : tag);
    node = parent;
    if (parts.length > LIMITS.pathDepth) return null;
  }
  return parts.length ? `/${parts.join('/')}` : null;
}

export function ancestorTrail(el: Element): string[] {
  const trail: string[] = [];
  let node: Element | null = el.parentElement;
  while (node && node.tagName !== 'HTML' && trail.length < LIMITS.ancestors) {
    trail.unshift(label(node));
    node = node.parentElement;
  }
  return trail;
}

export function nearestHeading(el: Element): string | null {
  let node: Element | null = el;
  while (node) {
    let sibling: Element | null = node.previousElementSibling;
    while (sibling) {
      const heading = sibling.matches('h1,h2,h3,h4,h5,h6')
        ? sibling
        : sibling.querySelector('h1,h2,h3,h4,h5,h6');
      if (heading?.textContent?.trim()) {
        return clamp(heading.textContent.replace(/\s+/g, ' ').trim(), LIMITS.elementText);
      }
      sibling = sibling.previousElementSibling;
    }
    node = node.parentElement;
  }
  return null;
}

function label(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = stableClasses(el)[0];
  return clamp(`${tag}${id}${cls ? `.${cls}` : ''}`, LIMITS.attrValue);
}
