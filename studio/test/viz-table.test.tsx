// Issue 206: every chart part carries its values as a visually hidden data table, so keyboard,
// touch and screen reader users reach what `title` gives a pointer. The plot is aria-hidden when
// the table is there; `table={false}` opts out (a decorative sparkline in a stat tile).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import axe from 'axe-core';
import * as React from 'react';
import { Sparkline, LineChart, Bars, HBars } from '../../react/viz';
import { VIZ_LABELS } from '../../react/labels';
import { Page as DataViz } from '../src/chapters/pages/data-viz';

type BarItem = React.ComponentProps<typeof Bars>['data'][number];
type HBarItem = React.ComponentProps<typeof HBars>['data'][number];
const bare = <T,>(item: { label: string; value: number }) => ({ ...item, suppressed: true }) as unknown as T;

/* A <table>, or (Sparkline, which sits in phrasing content) the same table built from ARIA roles on spans. */
const table = (c: Element) => c.querySelector('table, [role="table"]')!;
const caption = (c: Element) => {
  const t = table(c);
  return t.tagName === 'TABLE' ? t.querySelector('caption')?.textContent ?? null : t.getAttribute('aria-label');
};
const head = (c: Element) => [...table(c).querySelectorAll('thead th, [role="columnheader"]')].map((th) => th.textContent);
const rows = (c: Element) => {
  const t = table(c);
  const trs = t.tagName === 'TABLE' ? [...t.querySelectorAll('tbody tr')] : [...t.querySelectorAll('[role="row"]')].slice(1);
  return trs.map((tr) => [...tr.children].map((x) => x.textContent));
};

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { warn.mockRestore(); });

describe('the hidden data table', () => {
  it('Bars: one row per item, the printed value, the caption from label, the bar group aria-hidden', () => {
    const { container } = render(<Bars label="Daily visits" data={[{ label: 'Mon', value: 42 }, { label: 'Tue', value: 57, display: '57+' }]} />);
    expect(table(container).closest('.sr-only')).not.toBeNull();
    expect(caption(container)).toBe('Daily visits');
    expect(head(container)).toEqual([VIZ_LABELS.value]);
    expect(rows(container)).toEqual([['Mon', '42'], ['Tue', '57+']]);
    expect(table(container).querySelectorAll('tbody th[scope="row"]')).toHaveLength(2);
    expect(container.querySelector('.bars')!.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.bar')!.getAttribute('title')).toBe('Mon: 42');
  });

  it('Bars: prints values in the table even when showValues is off', () => {
    const { container } = render(<Bars showValues={false} data={[{ label: 'a', value: 5 }]} />);
    expect(rows(container)).toEqual([['a', '5']]);
    expect(caption(container)).toBe(VIZ_LABELS.table);
  });

  it('HBars: one row per item, formatted, each visible row aria-hidden and titled', () => {
    const { container } = render(<HBars label="By stage" format={(v) => `${v}%`} data={[{ label: 'x', value: 2 }, { label: 'y', value: 8, alt: true }]} />);
    expect(caption(container)).toBe('By stage');
    expect(head(container)).toEqual([VIZ_LABELS.value]);
    expect(rows(container)).toEqual([['x', '2%'], ['y', '8%']]);
    const bars = [...container.querySelectorAll('.hbar')];
    expect(bars.map((b) => b.getAttribute('aria-hidden'))).toEqual(['true', 'true']);
    expect(bars[1].getAttribute('title')).toBe('y: 8%');
  });

  it('LineChart: one row per x label, one column per drawn series, formatted, the svg aria-hidden', () => {
    const { container } = render(
      <LineChart label="Visits by week" labels={['W1', 'W2', 'W3']} format={(v) => `${v} kg`}
        series={[{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [4, 5, 6] }, { name: 'C', values: [7, 8, 9] }]} />,
    );
    expect(caption(container)).toBe('Visits by week');
    expect(head(container)).toEqual(['A', 'B']);
    expect(table(container).querySelector('thead td')).not.toBeNull();
    expect(rows(container)).toEqual([['W1', '1 kg', '4 kg'], ['W2', '2 kg', '5 kg'], ['W3', '3 kg', '6 kg']]);
    const svg = container.querySelector('.vizplot svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.hasAttribute('role')).toBe(false);
  });

  it('LineChart: a null point reads the withheld word the hover shows, and a short series leaves its cells empty', () => {
    const { container } = render(
      <LineChart labels={['W1', 'W2', 'W3']} series={[{ name: 'A', values: [1, null, Number.NaN] }, { name: 'B', values: [4] }]} />,
    );
    const w = VIZ_LABELS.withheld;
    expect(rows(container)).toEqual([['W1', '1', '4'], ['W2', w, ''], ['W3', w, '']]);
  });

  it('LineChart: the null cell takes the withheld word from vizLabels', () => {
    const { container } = render(<LineChart labels={['a', 'b']} series={[{ name: 'A', values: [1, null] }]} vizLabels={{ withheld: 'held back' }} />);
    expect(rows(container)).toEqual([['a', '1'], ['b', 'held back']]);
  });

  it('Sparkline: one row per point, numbered, a null as an empty cell', () => {
    const { container } = render(<Sparkline label="Quotes priced" values={[12, null, 14]} />);
    expect(caption(container)).toBe('Quotes priced');
    expect(head(container)).toEqual([VIZ_LABELS.value]);
    expect(rows(container)).toEqual([['1', '12'], ['2', ''], ['3', '14']]);
    expect(container.querySelector('.spark svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(table(container).querySelectorAll('[role="rowheader"]')).toHaveLength(3);
    expect(table(container).querySelectorAll('[role="cell"]').length).toBeGreaterThanOrEqual(3);
  });

  it('Sparkline: inside a paragraph, the server markup parses back unchanged and the table stays hidden', () => {
    const html = renderToStaticMarkup(<p>Visits <Sparkline values={[1, null, 3]} /> this week</p>);
    expect(html).not.toMatch(/<(table|caption|thead|tbody|tr|th|td)\b/);
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
    expect(doc.body.innerHTML).toBe(html);
    expect(doc.body.children).toHaveLength(1);
    const t = doc.querySelector('[role="table"]')!;
    expect(t.closest('.sr-only')).not.toBeNull();
    expect(t.closest('p')).not.toBeNull();
  });

  it('names a table with no label from vizLabels, default "Chart data"; a LineChart by its series', () => {
    expect(caption(render(<Bars data={[{ label: 'a', value: 1 }]} />).container)).toBe(VIZ_LABELS.table);
    expect(VIZ_LABELS.table).toBe('Chart data');
    expect(caption(render(<HBars data={[{ label: 'a', value: 1 }]} vizLabels={{ table: 'Stages' }} />).container)).toBe('Stages');
    expect(caption(render(<Sparkline values={[1]} />).container)).toBe(VIZ_LABELS.table);
    expect(caption(render(<LineChart labels={['a']} series={[{ name: 'A', values: [1] }, { name: 'B', values: [2] }]} />).container)).toBe('A vs B');
    expect(caption(render(<LineChart label="Mine" labels={['a']} series={[{ name: 'A', values: [1] }]} />).container)).toBe('Mine');
  });

  it('LineChart: the legend and the reference tag are aria-hidden with the table, and read without it', () => {
    const props = { labels: ['a', 'b'], series: [{ name: 'A', values: [1, 2] }, { name: 'B', values: [2, 1] }], reference: { value: 1, label: 'AVG' } };
    const on = render(<LineChart {...props} />).container;
    expect(on.querySelector('.vizlegend')!.getAttribute('aria-hidden')).toBe('true');
    expect(on.querySelector('.reftag')!.getAttribute('aria-hidden')).toBe('true');
    const off = render(<LineChart {...props} table={false} />).container;
    expect(off.querySelector('.vizlegend')!.hasAttribute('aria-hidden')).toBe(false);
    expect(off.querySelector('.reftag')!.hasAttribute('aria-hidden')).toBe(false);
  });

  it('table={false} renders no table and the plot as it was', () => {
    const off = [
      <Sparkline key="s" values={[1, 2]} table={false} />,
      <LineChart key="l" labels={['a', 'b']} series={[{ name: 'A', values: [1, 2] }]} table={false} />,
      <Bars key="b" data={[{ label: 'a', value: 1 }]} table={false} />,
      <HBars key="h" data={[{ label: 'a', value: 1 }]} table={false} />,
    ];
    for (const el of off) {
      const { container } = render(el);
      expect(container.querySelector('table, .sr-only')).toBeNull();
      expect(container.querySelector('.bars[aria-hidden], .hbar[aria-hidden], .vizplot svg[aria-hidden]')).toBeNull();
    }
    const line = render(<LineChart labels={['a', 'b']} series={[{ name: 'A', values: [1, 2] }]} table={false} />).container;
    expect(line.querySelector('svg')!.getAttribute('role')).toBe('img');
  });

  it('keeps Bars and HBars free of hooks with the table on', () => {
    expect(renderToStaticMarkup(<Bars data={[{ label: 'a', value: 1 }]} />)).toContain('<table');
    expect(renderToStaticMarkup(<HBars data={[{ label: 'a', value: 1 }]} />)).toContain('<table');
  });

  it('has no axe violations for any part, empty data included', async () => {
    const { container } = render(
      <div>
        <Sparkline label="s" values={[1, null, 3]} />
        <Sparkline values={[]} />
        <LineChart label="l" labels={['a', 'b']} series={[{ name: 'A', values: [1, null] }, { name: 'B', values: [2, 3] }]} />
        <LineChart labels={[]} series={[{ name: 'A', values: [] }]} />
        <Bars label="b" data={[{ label: 'a', value: 1 }, { label: 'b', value: 3, display: '<5', suppressed: true }]} />
        <Bars data={[]} />
        <HBars label="h" data={[{ label: 'a', value: 1 }, { label: 'b', value: 3, display: '<5', suppressed: true }]} />
        <HBars data={[]} />
      </div>,
    );
    const r = await axe.run(container, { rules: { region: { enabled: false } } });
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }, 60000);
});

describe('the hidden data table never carries a withheld value', () => {
  const bars = (secret: number): BarItem[] => [
    { label: 'a', value: 5 },
    { label: 'b', value: secret, display: '<5', suppressed: true },
    bare<BarItem>({ label: 'd', value: secret }),
  ];
  const hbars = (secret: number): HBarItem[] => [
    { label: 'a', value: 5 },
    { label: 'b', value: secret, display: '<5', suppressed: true },
    bare<HBarItem>({ label: 'd', value: secret }),
  ];

  it('Bars: prints display, or the withheld word with none, and the same markup at 3 and 987654', () => {
    for (const showValues of [true, false]) {
      const low = render(<Bars data={bars(3)} showValues={showValues} />).container;
      const high = render(<Bars data={bars(987654)} showValues={showValues} />).container;
      expect(rows(high)).toEqual([['a', '5'], ['b', '<5'], ['d', VIZ_LABELS.withheld]]);
      expect(table(high).outerHTML).toBe(table(low).outerHTML);
      expect(high.innerHTML).toBe(low.innerHTML);
      expect(high.innerHTML).not.toContain('987654');
    }
  });

  it('HBars: prints display unformatted, never calls format with the secret, and the same markup at 3 and 987654', () => {
    const seen: number[] = [];
    const format = (v: number) => { seen.push(v); return `${v}%`; };
    const low = render(<HBars data={hbars(3)} format={format} />).container;
    const high = render(<HBars data={hbars(987654)} format={format} />).container;
    expect(rows(high)).toEqual([['a', '5%'], ['b', '<5'], ['d', VIZ_LABELS.withheld]]);
    expect(high.innerHTML).toBe(low.innerHTML);
    expect(high.innerHTML).not.toContain('987654');
    expect(seen).not.toContain(987654);
    expect(seen).not.toContain(3);
  });

  it('LineChart and Sparkline: a null cell (withheld word, or empty on Sparkline) does not move with the other values', () => {
    const line = (k: number) => render(<LineChart labels={['a', 'b']} series={[{ name: 'A', values: [k, null] }]} />).container;
    expect(rows(line(987654))[1]).toEqual(['b', VIZ_LABELS.withheld]);
    const spark = render(<Sparkline values={[null, 4]} />).container;
    expect(rows(spark)[0]).toEqual(['1', '']);
  });

  it('takes the withheld word for a suppressed item with no display from vizLabels', () => {
    const { container } = render(<Bars data={[bare<BarItem>({ label: 'q', value: 9 })]} vizLabels={{ withheld: 'held back' }} />);
    expect(rows(container)).toEqual([['q', 'held back']]);
    expect(container.innerHTML).not.toContain('>9<');
  });

  it('takes the value header from vizLabels', () => {
    const { container } = render(<Bars data={[{ label: 'a', value: 1 }]} vizLabels={{ value: 'Count' }} />);
    expect(head(container)).toEqual(['Count']);
  });
});

describe('the data-viz chapter', () => {
  it('has no axe violations, and its kit parts carry captioned tables', async () => {
    const { container } = render(<DataViz />);
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    const caps = [...container.querySelectorAll('#suppressed table caption, #gaps table caption, #gaps [role="table"]')].map((c) => c.textContent || c.getAttribute('aria-label'));
    expect(caps).toHaveLength(4);
    expect(caps.every(Boolean)).toBe(true);
  }, 60000);
});
