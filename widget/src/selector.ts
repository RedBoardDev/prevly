import { finder } from '@medv/finder';
import { isStableAttr, isStableName } from './stability';
import { LIMITS, clamp } from './limits';

export function computeSelector(el: Element, doc: Document = document): string | null {
  const root = doc.body ?? doc.documentElement;
  const candidate = tryFinder(el, root);
  if (candidate && isUnique(doc, candidate, el)) return clamp(candidate, LIMITS.selector);

  const fallback = tagPath(el);
  if (fallback && isUnique(doc, fallback, el)) return clamp(fallback, LIMITS.selector);

  return null;
}


function tryFinder(el: Element, root: Element): string | null {
  try {
    return finder(el, {
      root,
      timeoutMs: 800,
      seedMinLength: 2,
      optimizedMinLength: 2,
      attr: isStableAttr,
      idName: isStableName,
      className: isStableName,
    });
  } catch {
    return null;
  }
}

export function tagPath(el: Element): string | null {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node) {
    const parent: Element | null = node.parentElement;
    const tag = node.tagName.toLowerCase();
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const index = Array.prototype.indexOf.call(parent.children, node) + 1;
    parts.unshift(`${tag}:nth-child(${index})`);
    node = parent;
    if (parts.length > 14) return null;
  }
  return parts.length ? parts.join(' > ') : null;
}

function isUnique(doc: Document, selector: string, el: Element): boolean {
  try {
    const found = doc.querySelectorAll(selector);
    return found.length === 1 && found[0] === el;
  } catch {
    return false;
  }
}

export function elementText(el: Element): string {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return clamp(text, LIMITS.elementText);
}

export function elementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
  const id = el.id ? `#${el.id}` : '';
  return `${tag}${id}${cls ? `.${cls}` : ''}`;
}
