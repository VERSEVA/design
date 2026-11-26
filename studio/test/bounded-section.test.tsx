// The bounded section React part: at most `cap` rows on screen (default 5), a status line that
// reads "+N more" only above the cap, a Show all action at the cap and above (named with its
// section, and only when it has somewhere to go), and the empty state. The served height test
// (test/served/bounded.test.mjs) holds the CSS half.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { BoundedSection, boundedCap, BOUNDED_CAP, type BoundedSectionProps } from '../../react/bounded-section';

const quotes = (n: number) => Array.from({ length: n }, (_, i) => `Q-${2081 - i}`);
const EMPTY = <div className="empty"><b>No quotes yet</b></div>;
type Extra = Partial<Omit<BoundedSectionProps<string>, 'href' | 'onShowAll'>> & { href?: string; onShowAll?: () => void; 'data-cap'?: string };
const view = (container: HTMLElement) => {
  const root = container.querySelector('section.bounded')!;
  return {
    root,
    rows: root.querySelectorAll('.bounded-rows > .lrow').length,
    more: root.querySelector('.bounded-more'),
    all: root.querySelector<HTMLElement>('.bounded-all'),
  };
};
const section = (n: number, props: Extra = {}) => {
  const { container } = render(
    <BoundedSection name="Quotes" items={quotes(n)} empty={EMPTY} href="/quotes" {...props}>
      {(q) => <div className="lrow">{q}</div>}
    </BoundedSection>,
  );
  return view(container);
};

afterEach(() => { vi.restoreAllMocks(); });

describe('BoundedSection', () => {
  it('caps at 5 by default', () => {
    expect(BOUNDED_CAP).toBe(5);
    expect(section(45).rows).toBe(5);
  });

  it.each([[1, '+1 more'], [40, '+40 more']])('reads the count at the cap plus %i', (extra, text) => {
    const s = section(BOUNDED_CAP + extra);
    expect(s.rows).toBe(BOUNDED_CAP);
    expect(s.more!.textContent).toBe(text);
    expect(s.more!.getAttribute('role')).toBe('status');
  });

  it.each([3, BOUNDED_CAP])('keeps the status line, empty, at %i rows', (n) => {
    const s = section(n);
    expect(s.rows).toBe(n);
    expect([s.more!.getAttribute('role'), s.more!.textContent, s.more!.childNodes.length]).toEqual(['status', '', 0]);
  });

  it('announces the step from 5 rows to 6 in the same status element', () => {
    const tree = (n: number) => <BoundedSection name="Quotes" items={quotes(n)} href="/quotes">{(q) => <div className="lrow">{q}</div>}</BoundedSection>;
    const { container, rerender } = render(tree(5));
    const status = container.querySelector('.bounded-more')!;
    rerender(tree(6));
    expect(container.querySelector('.bounded-more')).toBe(status);
    expect(status.textContent).toBe('+1 more');
  });

  it('shows Show all at the cap and above, and not below it', () => {
    expect(section(3).all).toBeNull();
    expect(section(BOUNDED_CAP).all!.textContent).toBe('Show all');
    expect(section(BOUNDED_CAP + 40).all!.textContent).toBe('Show all');
    expect(section(3, { cap: 3 }).all).not.toBeNull();
    expect(section(3, { total: 9 }).all).not.toBeNull();
  });

  it('keeps Show all below the cap on request, and tells the CSS', () => {
    const s = section(3, { showAllBelowCap: true });
    expect(s.all!.textContent).toBe('Show all');
    expect(s.root.getAttribute('data-all')).toBe('always');
    expect(section(3).root.hasAttribute('data-all')).toBe(false);
  });

  it('empty: the empty state, no rows element, no foot', () => {
    const s = section(0, { showAllBelowCap: true });
    expect(s.root.querySelector('.empty b')!.textContent).toBe('No quotes yet');
    expect(s.root.querySelector('.bounded-rows, .bounded-foot')).toBeNull();
  });

  it('names the section and puts that name in the action', () => {
    const s = section(8);
    const name = document.getElementById(s.root.getAttribute('aria-labelledby')!)!;
    expect([name.localName, name.textContent]).toEqual(['h3', 'Quotes']);
    expect(s.all!.getAttribute('aria-label')).toBe('Show all Quotes');
    expect(s.all!.className).toBe('btn btn-secondary sm bounded-all');
  });

  it('overrides the cap per instance and tells the CSS', () => {
    const s = section(45, { cap: 3 });
    expect(s.rows).toBe(3);
    expect(s.more!.textContent).toBe('+42 more');
    expect(s.root.getAttribute('data-cap')).toBe('3');
    expect(section(45).root.hasAttribute('data-cap')).toBe(false);
  });

  it('does not let a host attribute make the CSS cap disagree with the rows', () => {
    const s = section(45, { 'data-cap': '12', 'aria-labelledby': 'elsewhere', id: 'kept' });
    expect([s.rows, s.root.hasAttribute('data-cap'), s.root.id]).toEqual([5, false, 'kept']);
    expect(document.getElementById(s.root.getAttribute('aria-labelledby')!)!.textContent).toBe('Quotes');
    expect(section(45, { cap: 3, 'data-cap': '12' }).root.getAttribute('data-cap')).toBe('3');
  });

  it('falls back to 5 for a cap the CSS cannot hold, and warns in development', () => {
    for (const cap of [0, -1, 13, 99, 2.5, Number.NaN]) expect(boundedCap(cap), String(cap)).toBe(5);
    for (const cap of [1, 5, 12]) expect(boundedCap(cap)).toBe(cap);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = section(45, { cap: 99 });
    expect([s.rows, s.more!.textContent, s.root.hasAttribute('data-cap')]).toEqual([5, '+40 more', false]);
    expect(warn.mock.calls.map((c) => c[0])).toEqual(['BoundedSection: cap 99 is not a whole number from 1 to 12; using 5.']);
    warn.mockClear();
    section(45, { cap: 8 });
    section(45);
    expect(warn).not.toHaveBeenCalled();
  });

  it('stays quiet in a production build', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    try { section(45, { cap: 99 }); } finally { vi.unstubAllEnvs(); }
    expect(warn).not.toHaveBeenCalled();
  });

  it('counts from total when items is the first page', () => {
    expect(section(5, { total: 1204 }).more!.textContent).toBe('+1199 more');
    expect(section(5, { total: 5 }).more!.textContent).toBe('');
  });

  it('is a link with href, a button with onShowAll alone, and calls onShowAll', () => {
    const onShowAll = vi.fn();
    const link = section(8).all!;
    expect([link.localName, link.getAttribute('href')]).toEqual(['a', '/quotes']);
    const { container } = render(<BoundedSection name="Quotes" items={quotes(8)} onShowAll={onShowAll}>{(q) => <div className="lrow">{q}</div>}</BoundedSection>);
    const button = view(container).all!;
    expect([button.localName, button.getAttribute('type')]).toEqual(['button', 'button']);
    fireEvent.click(button);
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });

  it('renders no action when it has nowhere to go, and says so in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const Loose = BoundedSection as unknown as (props: Record<string, unknown>) => React.ReactElement;
    const { container } = render(<Loose name="Quotes" items={quotes(8)}>{(q: string) => <div className="lrow">{q}</div>}</Loose>);
    const s = view(container);
    expect([s.all, s.more!.textContent]).toEqual([null, '+3 more']);
    expect(warn.mock.calls.map((c) => c[0])).toEqual(['BoundedSection: pass href or onShowAll; without one there is no Show all action.']);
  });

  it('requires href or onShowAll in its props type', () => {
    // @ts-expect-error neither href nor onShowAll
    const el = <BoundedSection name="Quotes" items={quotes(1)}>{(q) => <div className="lrow">{q}</div>}</BoundedSection>;
    expect(el).toBeTruthy();
  });

  it('keys rows by the host key, so row state follows its item on reorder', () => {
    const tree = (items: string[]) => (
      <BoundedSection name="Quotes" items={items} href="/quotes" getKey={(q) => q}>
        {(q) => <div className="lrow" data-q={q}><input aria-label={q} /></div>}
      </BoundedSection>
    );
    const { container, rerender } = render(tree(['a', 'b', 'c']));
    const input = container.querySelector<HTMLInputElement>('[data-q="a"] input')!;
    fireEvent.change(input, { target: { value: 'typed' } });
    rerender(tree(['c', 'b', 'a']));
    expect(container.querySelector('[data-q="a"] input')).toBe(input);
    expect([...container.querySelectorAll<HTMLElement>('.lrow')].map((r) => r.dataset.q)).toEqual(['c', 'b', 'a']);
  });

  it("starts with 'use client': it attaches a handler", () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../react/bounded-section.tsx'), 'utf8');
    expect(src.startsWith("'use client';\n")).toBe(true);
  });
});
