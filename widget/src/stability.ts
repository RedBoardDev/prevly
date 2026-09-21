// Framework-generated ids and hashed CSS-module classes change on every build,
// hydration or render. Sent as-is they look like precise locators while
// matching nothing the next time anyone looks.
const GENERATED_PREFIX = /^(react-aria|radix|headlessui|mui|chakra|mantine|ant-|css-[a-z0-9]{5,}|:r[0-9a-z]+:)/i;
const HASHED_SEGMENT = /[A-Za-z]+[0-9][A-Za-z0-9]{4,}|_{2,}|[0-9a-f]{8,}/;

export function isStableName(name: string): boolean {
  if (!name) return false;
  if (GENERATED_PREFIX.test(name)) return false;
  return !HASHED_SEGMENT.test(name);
}

// Attributes carrying pointer or focus state are rewritten as the reviewer
// moves the mouse, so a selector built on one matches only for that instant.
const VOLATILE_ATTR =
  /^(data-(hovered|focused|focus-visible|pressed|selected|open|state|highlighted|placement|rac)|aria-(expanded|selected|checked|pressed|current|activedescendant|describedby|labelledby|controls|owns))$/;

export function isStableAttr(name: string, value: string): boolean {
  if (VOLATILE_ATTR.test(name)) return false;
  if (name === 'style') return false;
  // finder can fall back to [class="..."], which smuggles a hashed CSS-module
  // class past the className filter.
  if (name === 'class') return value.split(/\s+/).filter(Boolean).every(isStableName);
  if (name === 'id' && !isStableName(value)) return false;
  return value.length <= 80;
}
