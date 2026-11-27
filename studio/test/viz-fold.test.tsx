// Issue 194: charts are bounded too. `cap` on Bars and HBars folds the marks past it into one Other mark,
// last, on the alt fill; on LineChart it keeps the newest `cap` points and drops the oldest. Other is a
// privacy floor of its own: a suppressed item never adds to it, and Other is suppressed (display "<5")
// when it holds a suppressed item or its own total is under 5. Without `cap` every part renders as before.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import { Bars, HBars, LineChart } from '../../react/viz';
import { VIZ_LABELS, VIZ_FLOOR } from '../../react/labels';
import { chartCap, BOUNDED_CAP } from '../../react/bounded-state';

type BarItem = React.ComponentProps<typeof Bars>['data'][number];
type HBarItem = React.ComponentProps<typeof HBars>['data'][number];

const rows = (c: Element) => [...c.querySelectorAll('table tbody tr')].map((tr) => [...tr.children].map((x) => x.textContent));
const caption = (c: Element) => c.querySelector('table caption')!.textContent;
const barLabels = (c: Element) => [...c.querySelectorAll('.bar .mlab')].map((x) => x.textContent);
const hbarLabels = (c: Element) => [...c.querySelectorAll('.hbar .hlabel')].map((x) => x.textContent);
const last = <T,>(xs: T[]) => xs[xs.length - 1];

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { warn.mockRestore(); });

const five: BarItem[] = [
  { label: 'a', value: 40 }, { label: 'b', value: 30 }, { label: 'c', value: 20 }, { label: 'd', value: 10 }, { label: 'e', value: 8 },
];

describe('the copy and the limits live in labels.ts', () => {
  it('names Other, the floor label and the window note, with a floor of 5', () => {
    expect(VIZ_LABELS.other).toBe('Other');
    expect(VIZ_LABELS.floor).toBe('<5');
    expect(VIZ_LABELS.window(12)).toBe('Last 12');
    expect(VIZ_FLOOR).toBe(5);
  });

  it('chartCap: absent is no cap; a whole number from 1 applies; anything else is the bounded default', () => {
    expect(chartCap(undefined)).toBeUndefined();
    expect(chartCap(1)).toBe(1);
    expect(chartCap(13)).toBe(13);
    for (const bad of [0, -2, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(chartCap(bad)).toBe(BOUNDED_CAP);
  });
});

describe('Bars and HBars: the Other fold', () => {
  it('keeps the first cap items by position, folds the rest into one Other mark, last', () => {
    const data: BarItem[] = [...five, { label: 'f', value: 9 }, { label: 'g', value: 50 }];
    const c = render(<Bars data={data} cap={4} label="By day" />).container;
    expect(barLabels(c)).toEqual(['a', 'b', 'c', 'd', VIZ_LABELS.other]);
    expect(rows(c)).toEqual([['a', '40'], ['b', '30'], ['c', '20'], ['d', '10'], [VIZ_LABELS.other, '67']]);
    const h = render(<HBars data={data} cap={4} format={(v) => `${v}%`} />).container;
    expect(hbarLabels(h)).toEqual(['a', 'b', 'c', 'd', VIZ_LABELS.other]);
    expect(last(rows(h))).toEqual([VIZ_LABELS.other, '67%']);
  });

  it('counts N, N+1 and N+2: length equal to cap folds nothing', () => {
    expect(barLabels(render(<Bars data={five} cap={5} />).container)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(barLabels(render(<Bars data={[...five, { label: 'f', value: 6 }]} cap={5} />).container)).toEqual(['a', 'b', 'c', 'd', 'e', VIZ_LABELS.other]);
    const two = render(<Bars data={[...five, { label: 'f', value: 6 }, { label: 'g', value: 7 }]} cap={5} />).container;
    expect(barLabels(two)).toEqual(['a', 'b', 'c', 'd', 'e', VIZ_LABELS.other]);
    expect(last(rows(two))).toEqual([VIZ_LABELS.other, '13']);
  });

  it('draws Other on the alt fill, scaled like any bar, and keys it apart from a row already named Other', () => {
    const data: BarItem[] = [{ label: 'Other', value: 10 }, { label: 'b', value: 5 }, { label: 'c', value: 10 }];
    const c = render(<Bars data={data} cap={1} />).container;
    const fills = [...c.querySelectorAll('.bar .fill')] as HTMLElement[];
    expect(fills[1].style.background).toBe('var(--data-alt)');
    expect(fills[1].style.height).toBe('100%');
    expect(fills[0].style.height).toBe('66.66666666666666%');
    expect(warn).not.toHaveBeenCalled();
    const h = render(<HBars data={data} cap={1} />).container;
    expect(h.querySelectorAll('.hbar .htrack i')[1].className).toBe('alt');
  });

  it('a kept suppressed item stays as it was; the fold never reorders', () => {
    const data: BarItem[] = [{ label: 'a', value: 0, suppressed: true, display: '<5' }, { label: 'b', value: 9 }, { label: 'c', value: 6 }, { label: 'd', value: 7 }];
    const c = render(<Bars data={data} cap={2} />).container;
    expect(barLabels(c)).toEqual(['a', 'b', VIZ_LABELS.other]);
    expect(rows(c)).toEqual([['a', '<5'], ['b', '9'], [VIZ_LABELS.other, '13']]);
  });

  it('takes its words from vizLabels', () => {
    const c = render(<Bars data={[...five, { label: 'f', value: 1 }]} cap={5} vizLabels={{ other: 'Rest', floor: 'under 5' }} />).container;
    expect(last(barLabels(c))).toBe('Rest');
    expect(last(rows(c))).toEqual(['Rest', 'under 5']);
  });
});

describe('Other is a privacy floor', () => {
  const withSecret = (secret: number): BarItem[] => [...five, { label: 'f', value: 6 }, { label: 'g', value: secret, suppressed: true, display: '<5' }];
  const hWithSecret = (secret: number): HBarItem[] => withSecret(secret) as HBarItem[];

  it('a suppressed item never adds its value to Other, and makes Other suppressed', () => {
    for (const el of [<Bars key="b" data={withSecret(987654)} cap={5} />, <HBars key="h" data={hWithSecret(987654)} cap={5} />]) {
      const c = render(el).container;
      const other = c.querySelector('[data-suppressed]')!;
      expect(other.textContent).toContain(VIZ_LABELS.other);
      expect(other.textContent).toContain(VIZ_LABELS.floor);
      expect(other.querySelector('.fill, .htrack i')).toBeNull();
      expect(other.getAttribute('title')).toBe(`${VIZ_LABELS.other}: ${VIZ_LABELS.floor}`);
      expect(last(rows(c))).toEqual([VIZ_LABELS.other, VIZ_LABELS.floor]);
      expect(c.innerHTML).not.toMatch(/987654|987660/);
    }
  });

  it('an Other total under 5 is suppressed with display "<5"; 5 is printed', () => {
    const under = render(<Bars data={[...five, { label: 'f', value: 2 }, { label: 'g', value: 2 }]} cap={5} />).container;
    expect(under.querySelectorAll('[data-suppressed]')).toHaveLength(1);
    expect(last(rows(under))).toEqual([VIZ_LABELS.other, VIZ_LABELS.floor]);
    const at = render(<Bars data={[...five, { label: 'f', value: 2 }, { label: 'g', value: 3 }]} cap={5} />).container;
    expect(at.querySelector('[data-suppressed]')).toBeNull();
    expect(last(rows(at))).toEqual([VIZ_LABELS.other, '5']);
  });

  it('fails closed: a NaN or an infinite folded value makes Other suppressed with display "<5"', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const data: BarItem[] = [...five, { label: 'f', value: 9 }, { label: 'g', value: bad }];
      for (const c of [render(<Bars data={data} cap={5} />).container, render(<HBars data={data as HBarItem[]} cap={5} />).container]) {
        expect(c.querySelectorAll('[data-suppressed]')).toHaveLength(1);
        expect(last(rows(c))).toEqual([VIZ_LABELS.other, VIZ_LABELS.floor]);
        expect(c.innerHTML).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it('renders identical markup whether a hidden folded value is 3 or 987654, table on, Bars and HBars', () => {
    for (const showValues of [true, false]) {
      expect(renderToStaticMarkup(<Bars data={withSecret(987654)} cap={5} showValues={showValues} label="L" />))
        .toBe(renderToStaticMarkup(<Bars data={withSecret(3)} cap={5} showValues={showValues} label="L" />));
    }
    const seen: number[] = [];
    const format = (v: number) => { seen.push(v); return `${v}%`; };
    expect(renderToStaticMarkup(<HBars data={hWithSecret(987654)} cap={5} format={format} />))
      .toBe(renderToStaticMarkup(<HBars data={hWithSecret(3)} cap={5} format={format} />));
    expect(seen).not.toContain(987654);
    expect(seen).not.toContain(3);
    expect(seen).not.toContain(987660);
    expect(seen).not.toContain(9);
  });

  it('an Other total of 3 or 4 renders the same markup and the same scale; format never sees it', () => {
    const data = (k: number): HBarItem[] => [{ label: 'a', value: 4 }, { label: 'b', value: 1 }, { label: 'c', value: k - 1 }];
    expect(renderToStaticMarkup(<Bars data={data(4) as BarItem[]} cap={1} />)).toBe(renderToStaticMarkup(<Bars data={data(3) as BarItem[]} cap={1} />));
    const seen: number[] = [];
    const format = (v: number) => { seen.push(v); return String(v); };
    expect(renderToStaticMarkup(<HBars data={data(4)} cap={1} format={format} />)).toBe(renderToStaticMarkup(<HBars data={data(3)} cap={1} format={format} />));
    expect(seen).toEqual([4, 4]);
  });

  it('the hidden table carries the fold and the floor, never a folded item or its value', () => {
    const c = render(<HBars data={hWithSecret(987654)} cap={5} />).container;
    expect(rows(c).map((r) => r[0])).toEqual(['a', 'b', 'c', 'd', 'e', VIZ_LABELS.other]);
    expect(c.querySelector('table')!.textContent).not.toMatch(/\bf\b|\bg\b|987654/);
  });
});

describe('LineChart: the time window', () => {
  const labels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
  const series = [{ name: 'A', values: [90, 2, 3, null, 5, 6] }, { name: 'B', values: [9, 8, 7, 6] }];

  it('keeps the newest cap points, drops the oldest, aligned by index across series', () => {
    const c = render(<LineChart labels={labels} series={series} cap={3} />).container;
    expect(rows(c)).toEqual([['W4', VIZ_LABELS.withheld, '6'], ['W5', '5', ''], ['W6', '6', '']]);
    expect([...c.querySelectorAll('.xlabels span')].map((s) => s.textContent)).toEqual(['W4', 'W6']);
  });

  it('scales to the window: a dropped point never sets the top', () => {
    const windowed = renderToStaticMarkup(<LineChart labels={labels} series={[series[0]]} cap={2} table={false} />);
    const alone = renderToStaticMarkup(<LineChart labels={['W5', 'W6']} series={[{ name: 'A', values: [5, 6] }]} table={false} />);
    expect(windowed.replace(/<div class="vizlegend[^]*?<\/div>/, '')).toBe(alone);
  });

  it('says the window in a visible note and in the table caption', () => {
    const one = render(<LineChart labels={labels} series={[series[0]]} cap={3} label="Visits" />).container;
    expect(one.querySelector('.vizlegend')!.textContent).toBe(VIZ_LABELS.window(3));
    expect(caption(one)).toContain('Visits');
    expect(caption(one)).toContain(VIZ_LABELS.window(3));
    const two = render(<LineChart labels={labels} series={series} cap={3} vizLabels={{ window: (n) => `${n} weeks` }} />).container;
    expect(two.querySelector('.vizlegend')!.textContent).toContain('3 weeks');
    expect(two.querySelector('.vizlegend')!.textContent).toContain('A');
    expect(caption(two)).toContain('3 weeks');
  });
});

describe('without cap, or with a cap the data fits, every part renders as before', () => {
  const cases: [string, (cap?: number) => React.ReactElement][] = [
    ['bars', (cap) => <Bars data={[...five, { label: 'f', value: 0, suppressed: true, display: '<5' }]} cap={cap} label="x" />],
    ['hbars', (cap) => <HBars data={[...five, { label: 'f', value: 3, alt: true }]} cap={cap} format={(v) => `${v}%`} />],
    ['linechart', (cap) => <LineChart labels={['a', 'b', 'c', 'd', 'e', 'f']} series={[{ name: 'A', values: [1, 2, null, 4, 5, 6] }, { name: 'B', values: [3] }]} reference={{ value: 2, label: 'AVG' }} cap={cap} />],
  ];
  it.each(cases)('%s', (_name, make) => {
    const before = renderToStaticMarkup(make());
    expect(renderToStaticMarkup(make(undefined))).toBe(before);
    expect(renderToStaticMarkup(make(6))).toBe(before);
    expect(renderToStaticMarkup(make(40))).toBe(before);
    expect(renderToStaticMarkup(make(5))).not.toBe(before);
  });
});
