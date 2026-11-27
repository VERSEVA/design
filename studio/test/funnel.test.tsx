import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as React from 'react';
import { Funnel, type FunnelStep } from '../../react/funnel';

/* Issue 217. The step funnel (step rows), ported from the approved prototype: each step is an .hbar row
   scaled to the first step, with its count, its share of the first step and the drop from the step
   before. The biggest drop carries a neutral word chip. A suppressed step is a privacy floor. */
const S = (label: string, value: number): FunnelStep => ({ label, value });
const W = (label: string, value: number): FunnelStep => ({ label, value, display: '<5', suppressed: true });
const NORMAL = [S('Page views', 2480), S('Form starts', 620), S('Form completes', 434), S('Result views', 410), S('Contact requests', 151)];

const rows = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('ol.funnel > li.hbar')];
const text = (el: Element | null) => (el?.textContent ?? '').trim();
const shown = (el: Element | null) => text(el?.querySelector(':scope > [aria-hidden="true"]') ?? el);

describe('Funnel: shares, drops and the biggest drop', () => {
  it('draws one .hbar row per step with the bar scaled to the first step', () => {
    const { container } = render(<Funnel steps={NORMAL} />);
    const r = rows(container);
    expect(r).toHaveLength(5);
    expect(r.map((x) => text(x.querySelector('.hlabel')))).toEqual(NORMAL.map((s) => s.label));
    expect(r.map((x) => x.querySelector<HTMLElement>('.htrack > i')!.style.width)).toEqual(['100%', '25%', '17.5%', '16.5%', '6.1%']);
    expect(r.map((x) => text(x.querySelector('.hcount')))).toEqual(['2,480', '620', '434', '410', '151']);
  });

  it('prints the share of the first step in the panel form', () => {
    const { container } = render(<Funnel steps={NORMAL} share />);
    expect(container.querySelector('ol.funnel')!.hasAttribute('data-share')).toBe(true);
    const shares = rows(container).map((x) => x.querySelector('.funnel-share')!);
    expect(shares.map((s) => s.lastChild!.textContent)).toEqual(['100%', '25%', '18%', '17%', '6.1%']);
    expect(shares[1].querySelector('.sr-only')!.textContent).toBe('of first ');
  });

  it('leaves the share out of the tile form', () => {
    const { container } = render(<Funnel steps={NORMAL} />);
    expect(container.querySelector('ol.funnel')!.hasAttribute('data-share')).toBe(false);
    expect(container.querySelector('.funnel-share')).toBeNull();
    expect(container.querySelector('.funnel-head')).toBeNull();
  });

  it('prints the drop from the step before, none on the first step', () => {
    const { container } = render(<Funnel steps={NORMAL} />);
    const drops = rows(container).map((x) => x.querySelector('.funnel-drop')!);
    expect(drops[0].textContent).toBe('');
    expect(drops.slice(1).map(shown)).toEqual(['−75%', '−30%', '−6%', '−63%']);
    expect(text(drops[2].querySelector('.sr-only'))).toBe('drop 30%');
  });

  it('flags the biggest drop, and only it, with a neutral word chip', () => {
    const { container } = render(<Funnel steps={NORMAL} />);
    const flagged = container.querySelectorAll('.funnel-drop[data-biggest]');
    expect(flagged).toHaveLength(1);
    expect(flagged[0].closest('li')!.querySelector('.hlabel')!.textContent).toBe('Form starts');
    const chip = flagged[0].querySelector('.badge')!;
    expect(chip.className).toBe('badge neutral');
    expect(text(chip)).toBe('Biggest drop');
    expect(chip.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(container.innerHTML).not.toMatch(/accent|--good|--bad|data-sign/);
  });

  it('prints a rise as a plus and never flags it', () => {
    const { container } = render(<Funnel steps={[S('a', 100), S('b', 120), S('c', 60)]} />);
    const drops = rows(container).map((x) => x.querySelector('.funnel-drop')!);
    expect(shown(drops[1])).toBe('+20%');
    expect(text(drops[1].querySelector('.sr-only'))).toBe('rise 20%');
    expect(drops[1].hasAttribute('data-biggest')).toBe(false);
    expect(drops[2].hasAttribute('data-biggest')).toBe(true);
  });

  it('flags nothing when no step falls', () => {
    const { container } = render(<Funnel steps={[S('a', 10), S('b', 10)]} />);
    expect(container.querySelector('[data-biggest]')).toBeNull();
  });

  it('renders a single step: one full bar, a share of 100%, no drop and no flag', () => {
    const { container } = render(<Funnel steps={[S('Page views', 312)]} share />);
    const r = rows(container);
    expect(r).toHaveLength(1);
    expect(r[0].querySelector<HTMLElement>('.htrack > i')!.style.width).toBe('100%');
    expect(r[0].querySelector('.funnel-share')!.lastChild!.textContent).toBe('100%');
    expect(r[0].querySelector('.funnel-drop')!.textContent).toBe('');
    expect(container.querySelector('[data-biggest]')).toBeNull();
  });

  it('prints display in place of a known count, as a bar item does, and still draws from the value', () => {
    const { container } = render(<Funnel steps={[S('a', 200), { label: 'b', value: 50, display: '50 people' }]} />);
    const r = rows(container);
    expect(text(r[1].querySelector('.hcount'))).toBe('50 people');
    expect(r[1].querySelector<HTMLElement>('.htrack > i')!.style.width).toBe('25%');
    expect(text(container.querySelectorAll('table tbody tr')[1].querySelector('td'))).toBe('50 people');
  });

  it('formats counts through format', () => {
    const { container } = render(<Funnel steps={NORMAL} format={(v) => `n${v}`} />);
    expect(text(container.querySelector('.hcount'))).toBe('n2480');
  });
});

describe('Funnel: a suppressed step', () => {
  it('draws the withheld stub, prints display, and prints a dash for its share and both drops beside it', () => {
    const { container } = render(<Funnel steps={[S('a', 214), S('b', 61), W('c', 3), S('d', 20)]} share />);
    const r = rows(container);
    expect(r[2].hasAttribute('data-suppressed')).toBe(true);
    expect(r[2].querySelector('.htrack > i')).toBeNull();
    expect(text(r[2].querySelector('.hcount'))).toBe('<5');
    expect(r[2].querySelector('.funnel-share')!.lastChild!.textContent).toBe('-');
    expect(shown(r[2].querySelector('.funnel-drop'))).toBe('-');
    expect(shown(r[3].querySelector('.funnel-drop'))).toBe('-');
    expect(text(r[3].querySelector('.funnel-drop .sr-only'))).toBe('drop not exact');
    expect(r[3].querySelector('.funnel-share')!.lastChild!.textContent).toBe('9.3%');
  });

  it('never flags a drop beside a suppressed step, even the largest fall on either side of it', () => {
    /* 100 -> 90 is 10%; 90 -> withheld -> 10 is a 89% fall overall, but no drop beside it is exact */
    const { container } = render(<Funnel steps={[S('a', 100), S('b', 90), W('c', 2), S('d', 10)]} />);
    const flagged = [...container.querySelectorAll('[data-biggest]')];
    expect(flagged).toHaveLength(1);
    expect(flagged[0].closest('li')!.querySelector('.hlabel')!.textContent).toBe('b');
  });

  it('scales to the largest known step when the first step is withheld, and prints no share', () => {
    const { container } = render(<Funnel steps={[W('a', 3), S('b', 40), S('c', 10)]} share />);
    const r = rows(container);
    expect(r[1].querySelector<HTMLElement>('.htrack > i')!.style.width).toBe('100%');
    expect(r[2].querySelector<HTMLElement>('.htrack > i')!.style.width).toBe('25%');
    expect(r.map((x) => x.querySelector('.funnel-share')!.lastChild!.textContent)).toEqual(['-', '-', '-']);
    expect(shown(r[1].querySelector('.funnel-drop'))).toBe('-');
    expect(shown(r[2].querySelector('.funnel-drop'))).toBe('−75%');
  });

  it('prints no count for a suppressed step with no display, and the withheld word in the table', () => {
    const bare = { label: 'c', value: 4242, suppressed: true } as unknown as FunnelStep;
    const { container } = render(<Funnel steps={[S('a', 10), bare]} />);
    expect(container.innerHTML).not.toContain('4242');
    expect(text(rows(container)[1].querySelector('.hcount'))).toBe('');
    expect(text(container.querySelectorAll('table tbody tr')[1].querySelector('td'))).toBe('withheld');
  });

  /* The permanent privacy probe: the same funnel with the suppressed value at 3 and at 987654 renders the
     same document, wherever the step sits (first is the scale denominator), in both forms, with and without
     the hidden table. */
  const at = (i: number, secret: number) => NORMAL.map((s, j) => (j === i ? { label: s.label, value: secret, display: '<5', suppressed: true as const } : s));
  for (const pos of [0, 2, 4]) {
    for (const share of [false, true]) {
      for (const table of [false, true]) {
        it(`renders the same markup whatever the hidden value is (step ${pos + 1}, ${share ? 'panel' : 'tile'}, table ${table ? 'on' : 'off'})`, () => {
          const low = render(<Funnel steps={at(pos, 3)} share={share} table={table} />).container.innerHTML;
          const high = render(<Funnel steps={at(pos, 987654)} share={share} table={table} />).container.innerHTML;
          expect(high).toBe(low);
          expect(high).not.toContain('987654');
        });
      }
    }
  }
});

describe('Funnel: the hidden data table', () => {
  it('renders a visually hidden table with a caption, one row per step, and hides the list from assistive tech', () => {
    const { container } = render(<Funnel steps={[S('a', 200), S('b', 50), W('c', 3)]} label="Sign-up funnel" />);
    const table = container.querySelector('table')!;
    expect(table.parentElement!.className).toBe('sr-only');
    expect(text(table.querySelector('caption'))).toBe('Sign-up funnel');
    expect([...table.querySelectorAll('thead th')].map(text)).toEqual(['Step', 'Count', 'Of first', 'Drop']);
    const body = [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map(text));
    expect(body).toEqual([
      ['a', '200', '100%', ''],
      ['b', '50', '25%', '−75%, Biggest drop'],
      ['c', '<5', '-', 'drop not exact'],
    ]);
    expect(table.querySelectorAll('tbody th[scope="row"]')).toHaveLength(3);
    expect(container.querySelector('ol.funnel')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('opts out with table={false}: the list is named and read', () => {
    const { container } = render(<Funnel steps={NORMAL} table={false} />);
    expect(container.querySelector('table')).toBeNull();
    const ol = container.querySelector('ol.funnel')!;
    expect(ol.hasAttribute('aria-hidden')).toBe(false);
    expect(ol.getAttribute('aria-label')).toBe('Funnel steps');
  });
});

describe('Funnel: the panel head, the empty and the loading states', () => {
  it('puts the column labels in an aria-hidden head row in the panel form', () => {
    const { container } = render(<Funnel steps={NORMAL} share table={false} />);
    const head = container.querySelector('ol.funnel > li.funnel-head')!;
    expect(head.getAttribute('aria-hidden')).toBe('true');
    expect([...head.children].map((c) => c.textContent)).toEqual(['Step', '', 'Count', 'Of first', 'Drop']);
  });

  it('takes its words from labels', () => {
    const { container } = render(<Funnel steps={NORMAL} share labels={{ share: 'Of landing', biggest: 'Largest fall' }} />);
    expect(container.querySelector('.funnel-head')!.children[3].textContent).toBe('Of landing');
    expect(text(container.querySelector('[data-biggest] .badge'))).toBe('Largest fall');
  });

  it('shows the empty state for no steps, and a host empty in its place', () => {
    const { container } = render(<Funnel steps={[]} />);
    expect(container.querySelector('ol')).toBeNull();
    expect(container.querySelector('table')).toBeNull();
    expect(text(container.querySelector('.empty b'))).toBe('No funnel events');
    const host = render(<Funnel steps={[]} empty={<p className="wtile-sub">Nothing yet</p>} />).container;
    expect(host.querySelector('.empty')).toBeNull();
    expect(text(host.querySelector('.wtile-sub'))).toBe('Nothing yet');
  });

  it('shows five skeleton rows of the real layout while loading, hidden from assistive tech, with no table', () => {
    const panel = render(<Funnel steps={NORMAL} share loading />).container;
    const ol = panel.querySelector('ol.funnel')!;
    expect(ol.getAttribute('aria-hidden')).toBe('true');
    expect(ol.hasAttribute('data-share')).toBe(true);
    const r = rows(panel);
    expect(r).toHaveLength(5);
    expect(r.every((x) => x.querySelectorAll('.skel').length === 5)).toBe(true);
    expect(panel.querySelector('table')).toBeNull();
    expect(panel.textContent).toBe('');
    const tile = render(<Funnel steps={[]} loading />).container;
    expect(rows(tile).every((x) => x.querySelectorAll('.skel').length === 4)).toBe(true);
  });

  it('passes className to the list', () => {
    const { container } = render(<Funnel steps={NORMAL} className="extra" />);
    expect(container.querySelector('ol.funnel.extra')).not.toBeNull();
  });
});
