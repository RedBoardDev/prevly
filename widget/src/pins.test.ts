import { beforeEach, describe, expect, it } from 'vitest';
import { currentPage, forPage, resolvePins } from './pins';
import { computeSelector } from './selector';
import type { FeedbackItem } from './types';

function item(partial: Partial<FeedbackItem> & { id: string }): FeedbackItem {
  return {
    page: '/reports',
    author: 'Thomas',
    comment: 'hm',
    created_at: '2026-09-21T10:00:00Z',
    ...partial,
  } as FeedbackItem;
}

beforeEach(() => {
  document.body.innerHTML = `
    <main id="app">
      <table><tbody><tr><td class="total">1 234,00 €</td></tr></tbody></table>
      <button class="cta">Envoyer</button>
    </main>
    <prevly-feedback><span class="total"></span></prevly-feedback>
  `;
});

describe('currentPage', () => {
  it('joins pathname and search', () => {
    expect(currentPage({ pathname: '/reports/1', search: '?tab=costs' })).toBe(
      '/reports/1?tab=costs',
    );
    expect(currentPage({ pathname: '/', search: '' })).toBe('/');
  });
});

describe('forPage', () => {
  it('keeps only exact page matches, oldest first', () => {
    const items = [
      item({ id: 'b', page: '/reports', created_at: '2026-09-21T12:00:00Z' }),
      item({ id: 'a', page: '/reports', created_at: '2026-09-21T09:00:00Z' }),
      item({ id: 'c', page: '/reports?tab=costs' }),
      item({ id: 'd', page: '/other' }),
    ];
    expect(forPage(items, '/reports').map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('resolvePins', () => {
  it('splits resolvable selectors from orphans and numbers them together', () => {
    const items = [
      item({ id: 'a', selector: 'td.total', created_at: '2026-09-21T09:00:00Z' }),
      item({ id: 'b', selector: '.gone', created_at: '2026-09-21T10:00:00Z' }),
      item({ id: 'c', selector: 'button.cta', created_at: '2026-09-21T11:00:00Z' }),
      item({ id: 'd', selector: null, created_at: '2026-09-21T12:00:00Z' }),
      item({ id: 'e', page: '/elsewhere', selector: 'td.total' }),
    ];

    const { matched, orphans } = resolvePins(items, '/reports', document);
    expect(matched.map((m) => [m.item.id, m.n])).toEqual([
      ['a', 1],
      ['c', 3],
    ]);
    expect(orphans.map((o) => [o.item.id, o.n])).toEqual([
      ['b', 2],
      ['d', 4],
    ]);
    expect(matched[0]?.el.textContent).toContain('1 234,00');
  });

  it('treats an invalid selector as an orphan', () => {
    const items = [item({ id: 'a', selector: 'td:::bad(' })];
    const { matched, orphans } = resolvePins(items, '/reports', document);
    expect(matched).toHaveLength(0);
    expect(orphans.map((o) => o.item.id)).toEqual(['a']);
  });

  it('never pins an element inside the widget host', () => {
    const host = document.querySelector('prevly-feedback') as Element;
    const items = [item({ id: 'a', selector: 'prevly-feedback > .total' })];
    const { matched, orphans } = resolvePins(items, '/reports', document, host);
    expect(matched).toHaveLength(0);
    expect(orphans).toHaveLength(1);
  });
});

describe('selector stability', () => {
  it('never builds a selector on a pointer or focus state attribute', () => {
    document.body.innerHTML = `
      <main>
        <form>
          <button data-hovered="true" data-pressed="true" aria-expanded="false" class="btn">Se connecter</button>
        </form>
      </main>`;
    const button = document.querySelector('button') as Element;

    const selector = computeSelector(button);
    expect(selector).toBeTruthy();
    expect(selector).not.toContain('data-hovered');
    expect(selector).not.toContain('data-pressed');
    expect(selector).not.toContain('aria-expanded');

    button.removeAttribute('data-hovered');
    button.removeAttribute('data-pressed');
    expect(document.querySelectorAll(selector as string)).toHaveLength(1);
  });
});
