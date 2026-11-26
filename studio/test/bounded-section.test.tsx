// The bounded section React part: at most `cap` rows on screen (default 5), a "+N more" count
// only above the cap, a Show all action named with its section, and the empty state. The served
// height test (test/served/bounded.test.mjs) holds the CSS half.
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { BoundedSection, boundedCap, BOUNDED_CAP } from '../../react/bounded-section';

const quotes = (n: number) => Array.from({ length: n }, (_, i) => `Q-${2081 - i}`);
const section = (n: number, props: Partial<React.ComponentProps<typeof BoundedSection<string>>> = {}) => {
  const { container } = render(
    <BoundedSection name="Quotes" items={quotes(n)} empty={<div className="empty"><b>No quotes yet</b></div>} {...props}>
      {(q) => <div className="lrow">{q}</div>}
    </BoundedSection>,
  );
  const root = container.querySelector('section.bounded')!;
  return {
    root,
    rows: root.querySelectorAll('.bounded-rows > .lrow').length,
    more: root.querySelector('.bounded-more'),
    all: root.querySelector<HTMLElement>('.bounded-all'),
  };
};

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

  it.each([3, BOUNDED_CAP])('has no count row at %i rows, and keeps the action', (n) => {
    const s = section(n);
    expect(s.rows).toBe(n);
    expect(s.more).toBeNull();
    expect(s.all!.textContent).toBe('Show all');
  });

  it('empty: the empty state, no rows element, no foot', () => {
    const s = section(0);
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

  it('falls back to the default for a cap the CSS cannot hold', () => {
    for (const cap of [0, -1, 13, 99, 2.5, Number.NaN]) expect(boundedCap(cap), String(cap)).toBe(5);
    for (const cap of [1, 5, 12]) expect(boundedCap(cap)).toBe(cap);
    const s = section(45, { cap: 99 });
    expect([s.rows, s.more!.textContent, s.root.hasAttribute('data-cap')]).toEqual([5, '+40 more', false]);
  });

  it('counts from total when items is the first page', () => {
    expect(section(5, { total: 1204 }).more!.textContent).toBe('+1199 more');
    expect(section(5, { total: 5 }).more).toBeNull();
  });

  it('is a link with href, a button without, and calls onShowAll', () => {
    const onShowAll = vi.fn();
    const link = section(8, { href: '/quotes' }).all!;
    expect([link.localName, link.getAttribute('href')]).toEqual(['a', '/quotes']);
    const button = section(8, { onShowAll }).all!;
    expect([button.localName, button.getAttribute('type')]).toEqual(['button', 'button']);
    fireEvent.click(button);
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });
});
