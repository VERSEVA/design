import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { Sparkline, LineChart, Bars, HBars, Ring, ActivityStrip, Trend } from '../../react/viz';

/* Dashboards render before data arrives: empty arrays are a normal input and must not throw. */
const stubBox = (svg: Element) => {
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 320, height: 140, right: 320, bottom: 140, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
};
/* jsdom has no PointerEvent, so fireEvent.pointerMove drops clientX; a MouseEvent of the same type keeps it. */
const move = (el: Element, clientX: number) =>
  fireEvent(el, new MouseEvent('pointermove', { bubbles: true, clientX }));

describe('Sparkline', () => {
  it('renders an empty svg for no data, with no path and no dot', () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(container.querySelector('.spark svg')).not.toBeNull();
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });

  it('draws one line path and a last-point dot, plus the area path when area is set', () => {
    const line = render(<Sparkline values={[1, 3, 2]} area={false} />).container;
    expect(line.querySelectorAll('path')).toHaveLength(1);
    expect(line.querySelectorAll('circle')).toHaveLength(1);
    const area = render(<Sparkline values={[1, 3, 2]} />).container;
    expect(area.querySelectorAll('path')).toHaveLength(2);
    expect(area.querySelector('path')!.getAttribute('fill')).toMatch(/^url\(#/);
  });
});

describe('LineChart', () => {
  const labels = ['Mon', 'Tue', 'Wed'];

  it('renders an empty svg when a series has no values', () => {
    const { container } = render(<LineChart labels={[]} series={[{ name: 'A', values: [] }]} />);
    const svg = container.querySelector('.vizplot svg')!;
    expect(svg).not.toBeNull();
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    stubBox(svg);
    expect(() => move(svg, 100)).not.toThrow();
  });

  it('names the plot "A vs B", drops a third series, and dashes the second', () => {
    const { container } = render(
      <LineChart
        labels={labels}
        series={[
          { name: 'A', values: [1, 2, 3] },
          { name: 'B', values: [3, 2, 1] },
          { name: 'C', values: [2, 2, 2] },
        ]}
      />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('A vs B');
    const lines = Array.from(container.querySelectorAll('path[fill="none"]'));
    expect(lines).toHaveLength(2);
    expect(lines[0].getAttribute('stroke-dasharray')).toBeNull();
    expect(lines[1].getAttribute('stroke-dasharray')).toBe('5 4');
    expect(container.querySelector('.vizlegend')!.textContent).not.toContain('C');
  });

  it('shows the label and formatted values on pointer move, and clears on leave', () => {
    render(
      <LineChart
        labels={labels}
        series={[
          { name: 'A', values: [1, 2, 3] },
          { name: 'B', values: [4, 5, 6] },
        ]}
        format={(v) => `${v} kg`}
      />,
    );
    const svg = screen.getByRole('img');
    stubBox(svg);
    move(svg, 160);
    const tip = screen.getByRole('status');
    expect(tip.querySelector('b')!.textContent).toBe('Tue');
    expect(tip.textContent).toContain('A 2 kg');
    expect(tip.textContent).toContain('B 5 kg');
    fireEvent.pointerLeave(svg);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('skips a short second series on hover instead of throwing', () => {
    const { container } = render(
      <LineChart
        labels={labels}
        series={[
          { name: 'A', values: [1, 2, 3] },
          { name: 'B', values: [4] },
        ]}
      />,
    );
    const svg = screen.getByRole('img');
    stubBox(svg);
    expect(() => move(svg, 320)).not.toThrow();
    const tip = screen.getByRole('status');
    expect(tip.textContent).toContain('A 3');
    expect(tip.textContent).not.toContain('B');
    expect(container.querySelectorAll('circle[r="4"]')).toHaveLength(1);
  });
});

describe('Bars', () => {
  it('prints values on the marks, scales the max to 100%, and applies level', () => {
    const { container } = render(
      <Bars data={[{ label: 'a', value: 5 }, { label: 'b', value: 10, level: 2 }]} />,
    );
    expect(Array.from(container.querySelectorAll('.vlab')).map((e) => e.textContent)).toEqual(['5', '10']);
    const fills = container.querySelectorAll<HTMLElement>('.fill');
    expect(fills[0].style.height).toBe('50%');
    expect(fills[1].style.height).toBe('100%');
    expect(fills[1].style.background).toBe('var(--data-2)');
    expect(fills[0].style.background).toBe('');
  });
});

describe('HBars', () => {
  it('prints formatted counts, scales the max to 100%, and marks alt rows', () => {
    const { container } = render(
      <HBars data={[{ label: 'x', value: 2 }, { label: 'y', value: 8, alt: true }]} format={(v) => `${v}%`} />,
    );
    expect(Array.from(container.querySelectorAll('.hcount')).map((e) => e.textContent)).toEqual(['2%', '8%']);
    const bars = container.querySelectorAll<HTMLElement>('.htrack i');
    expect(bars[0].style.width).toBe('25%');
    expect(bars[1].style.width).toBe('100%');
    expect(bars[1].className).toBe('alt');
    expect(bars[0].className).toBe('');
  });
});

describe('Ring', () => {
  it('clamps value to 0..100 for the aria-label and the dash offset', () => {
    render(
      <>
        <Ring value={140} center="Over" />
        <Ring value={-10} center="Under" sub="left" />
      </>,
    );
    const [over, under] = screen.getAllByRole('img');
    expect(over.getAttribute('aria-label')).toBe('Over: 100%');
    expect(under.getAttribute('aria-label')).toBe('Under left: 0%');
    const offset = (el: Element) => Number(el.querySelector('.ringfill')!.getAttribute('stroke-dashoffset'));
    const dash = (el: Element) => Number(el.querySelector('.ringfill')!.getAttribute('stroke-dasharray'));
    expect(offset(over)).toBe(0);
    expect(offset(under)).toBe(dash(under));
  });
});

describe('ActivityStrip', () => {
  it('marks today and titles each cell from labels', () => {
    const { container } = render(<ActivityStrip levels={[0, 2, 3]} todayIndex={2} labels={['Mon', 'Tue', 'Wed']} />);
    const cells = container.querySelectorAll('i');
    expect(cells[2].className).toBe('today');
    expect(cells[0].className).toBe('');
    expect(Array.from(cells).map((c) => c.getAttribute('title'))).toEqual([
      'Mon: level 0',
      'Tue: level 2',
      'Wed: level 3',
    ]);
  });
});

describe('Trend', () => {
  it('points down for hyphen and minus-sign deltas, sideways for flat, up otherwise', () => {
    const { container } = render(
      <>
        <Trend delta="-4 kg" judgment="good" />
        <Trend delta="−52 s" judgment="good" />
        <Trend delta="0" judgment="flat" />
        <Trend delta="+3" judgment="bad" />
      </>,
    );
    const spans = Array.from(container.querySelectorAll('.trend'));
    expect(spans.map((s) => s.textContent)).toEqual(['↓ -4 kg', '↓ −52 s', '→ 0', '↑ +3']);
    expect(spans[3].className).toBe('trend bad');
  });
});

/* Issue 205. A suppressed item is a privacy floor: the consumer hands the true value over, and nothing
   derived from it may reach the page. The differential tests render the same chart with the suppressed
   value small and then huge, and hold the two documents identical: the stub, the title and the labels. */
type BarItem = React.ComponentProps<typeof Bars>['data'][number];
type HBarItem = React.ComponentProps<typeof HBars>['data'][number];
/* A caller that slipped past the types: suppressed with no display. */
const bare = <T,>(item: { label: string; value: number }) => ({ ...item, suppressed: true }) as unknown as T;

describe('Bars: suppressed items and display', () => {
  const data = (secret: number): BarItem[] => [
    { label: 'a', value: 5 },
    { label: 'b', value: secret, display: '<5', suppressed: true, level: 3 },
    { label: 'c', value: 10 },
    bare<BarItem>({ label: 'd', value: secret }),
  ];
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  it('draws the withheld stub with no fill and prints display on it', () => {
    const { container } = render(<Bars data={data(3)} />);
    const bar = container.querySelectorAll<HTMLElement>('.bar')[1];
    expect(bar.querySelector('.fill')).toBeNull();
    expect(bar.querySelectorAll('.vtrack')).toHaveLength(1);
    expect(bar.querySelector('.vtrack')!.attributes).toHaveLength(1);
    expect([...bar.children].map((c) => c.className)).toEqual(['vlab', 'vtrack', 'mlab']);
    expect(bar.querySelector('.vlab')!.textContent).toBe('<5');
    expect(bar.querySelector('.vlab')!.attributes).toHaveLength(1);
    expect(bar.hasAttribute('data-suppressed')).toBe(true);
    expect(bar.getAttribute('title')).toBe('b: <5');
  });

  it('leaves suppressed items out of the scale', () => {
    const { container } = render(<Bars data={data(9999)} />);
    const fills = container.querySelectorAll<HTMLElement>('.fill');
    expect(fills).toHaveLength(2);
    expect(fills[0].style.height).toBe('50%');
    expect(fills[1].style.height).toBe('100%');
  });

  it('renders the same document whatever the suppressed value is', () => {
    const low = render(<Bars data={data(3)} />).container.innerHTML;
    const high = render(<Bars data={data(987654)} />).container.innerHTML;
    expect(high).toBe(low);
    expect(high).not.toContain('987654');
    const quiet = render(<Bars data={data(987654)} showValues={false} />).container;
    expect(quiet.innerHTML).toBe(render(<Bars data={data(3)} showValues={false} />).container.innerHTML);
    expect(quiet.innerHTML).not.toContain('987654');
    expect(quiet.querySelector('.vlab')).toBeNull();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('987654');
  });

  it('prints no label for a suppressed item with no display, names it withheld in the title, and warns', () => {
    const { container } = render(<Bars data={[bare<BarItem>({ label: 'a', value: 4242 }), { label: 'b', value: 2 }]} />);
    expect(container.innerHTML).not.toContain('4242');
    const bar = container.querySelector('.bar')!;
    expect(bar.querySelector('.vlab')).toBeNull();
    expect(bar.querySelector('.vtrack')).not.toBeNull();
    expect(bar.getAttribute('title')).toBe('a: withheld');
    expect(container.textContent).not.toMatch(/n\/a|withheld/i);
    expect(container.querySelector<HTMLElement>('.fill')!.style.height).toBe('100%');
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toMatch(/Bars.*"a".*display/);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('4242');
  });

  it('renders the same document whatever the value of a suppressed item with no display', () => {
    const only = (secret: number) => [{ label: 'p', value: 7 }, bare<BarItem>({ label: 'q', value: secret })];
    const low = render(<Bars data={only(3)} />).container.innerHTML;
    const high = render(<Bars data={only(987654)} />).container.innerHTML;
    expect(high).toBe(low);
    expect(high).not.toContain('987654');
    expect(high).toContain('title="q: withheld"');
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/987654|\b3\b/);
  });

  it('warns once for the same missing display, however often it renders', () => {
    const data = [bare<BarItem>({ label: 'once', value: 1 })];
    const { rerender } = render(<Bars data={data} />);
    rerender(<Bars data={data} height={90} />);
    render(<Bars data={data} />);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('takes the withheld word from vizLabels', () => {
    const { container } = render(<Bars data={[bare<BarItem>({ label: 'a', value: 1 })]} vizLabels={{ withheld: 'Not shown' }} />);
    expect(container.querySelector('.bar')!.getAttribute('title')).toBe('a: Not shown');
  });

  it('keeps the fill when only display is given, and prints display in place of the value', () => {
    const { container } = render(<Bars data={[{ label: 'a', value: 1200, display: '1.2k' }, { label: 'b', value: 2400 }]} />);
    const bars = container.querySelectorAll<HTMLElement>('.bar');
    expect(bars[0].querySelector<HTMLElement>('.fill')!.style.height).toBe('50%');
    expect(bars[0].querySelector('.vtrack')).toBeNull();
    expect(bars[0].hasAttribute('data-suppressed')).toBe(false);
    expect(bars[0].querySelector('.vlab')!.textContent).toBe('1.2k');
    expect(bars[0].getAttribute('title')).toBe('a: 1.2k');
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not throw when every item is suppressed', () => {
    const { container } = render(<Bars data={[{ label: 'a', value: 3, display: '<5', suppressed: true }]} />);
    expect(container.querySelectorAll('.fill')).toHaveLength(0);
    expect(container.querySelectorAll('.vtrack')).toHaveLength(1);
  });
});

describe('HBars: suppressed items and display', () => {
  const data = (secret: number): HBarItem[] => [
    { label: 'x', value: 2 },
    { label: 'y', value: secret, display: '<5', suppressed: true, alt: true },
    { label: 'z', value: 8, alt: true },
    bare<HBarItem>({ label: 'w', value: secret }),
  ];
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  it('draws the track with nothing in it and prints display, unformatted', () => {
    const { container } = render(<HBars data={data(3)} format={(v) => `${v}%`} />);
    const row = container.querySelectorAll<HTMLElement>('.hbar')[1];
    expect(row.querySelectorAll('.htrack')).toHaveLength(1);
    expect(row.querySelector('.htrack')!.children).toHaveLength(0);
    expect(row.querySelector('.htrack')!.attributes).toHaveLength(1);
    expect(row.querySelector('.hcount')!.textContent).toBe('<5');
    expect(row.querySelector('.hcount')!.attributes).toHaveLength(1);
    expect(row.hasAttribute('data-suppressed')).toBe(true);
    expect(row.getAttribute('title')).toBe('y: <5');
  });

  it('leaves suppressed items out of the scale, and keeps alt on the rows that draw', () => {
    const { container } = render(<HBars data={data(9999)} />);
    const fills = container.querySelectorAll<HTMLElement>('.htrack i');
    expect(fills).toHaveLength(2);
    expect(fills[0].style.width).toBe('25%');
    expect(fills[1].style.width).toBe('100%');
    expect(fills[1].className).toBe('alt');
  });

  it('renders the same document whatever the suppressed value is, and never formats it', () => {
    const seen: number[] = [];
    const format = (v: number) => { seen.push(v); return `${v}%`; };
    const low = render(<HBars data={data(3)} format={format} />).container.innerHTML;
    const high = render(<HBars data={data(987654)} format={format} />).container.innerHTML;
    expect(high).toBe(low);
    expect(high).not.toContain('987654');
    expect(seen).not.toContain(987654);
    expect(seen).not.toContain(3);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('987654');
  });

  it('prints no label for a suppressed item with no display, keeps the count column, and warns', () => {
    const { container } = render(<HBars data={[bare<HBarItem>({ label: 'x', value: 4242 }), { label: 'y', value: 2 }]} vizLabels={{ withheld: 'Not shown' }} />);
    expect(container.innerHTML).not.toContain('4242');
    const row = container.querySelector('.hbar')!;
    expect(row.querySelector('.hcount')!.textContent).toBe('');
    expect(row.getAttribute('title')).toBe('x: Not shown');
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('4242');
  });

  it('renders the same document whatever the value of a suppressed item with no display', () => {
    const only = (secret: number) => [{ label: 'p', value: 7 }, bare<HBarItem>({ label: 'q', value: secret })];
    const low = render(<HBars data={only(3)} />).container.innerHTML;
    const high = render(<HBars data={only(987654)} />).container.innerHTML;
    expect(high).toBe(low);
    expect(high).not.toContain('987654');
    expect(high).toContain('title="q: withheld"');
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/987654|\b3\b/);
  });

  it('keeps the fill when only display is given, and prints display in place of the formatted value', () => {
    const { container } = render(<HBars data={[{ label: 'x', value: 1200, display: '1.2k' }, { label: 'y', value: 2400 }]} format={(v) => `${v} u`} />);
    const rows = container.querySelectorAll<HTMLElement>('.hbar');
    expect(rows[0].querySelector<HTMLElement>('.htrack i')!.style.width).toBe('50%');
    expect(rows[0].querySelector('.hcount')!.textContent).toBe('1.2k');
    expect(rows[0].getAttribute('title')).toBe('x: 1.2k');
    expect(rows[1].querySelector('.hcount')!.textContent).toBe('2400 u');
  });
});

/* A null is a gap: the line breaks, no point is drawn there, and it is never zero or bridged. A hatched
   band under the plot, clear of the zero baseline, says those indices are withheld, not broken. */
const subpaths = (d: string) => d.split('M').filter(Boolean).length;
const ys = (d: string) => [...d.matchAll(/[ML]?\s*(-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));
/* The gap band: a hatched strip below the zero baseline, over the null indices only. */
const round = (n: number) => Math.round(n * 10) / 10;
const bandEls = (root: Element) => [...root.querySelectorAll<HTMLElement>('i.vizgap')];
/* [x, width, y] in viewBox units, from the percentages the band is positioned with (W x H is the viewBox).
   y is 2 units below the baseline, in the plot's own units, so the clearance grows with the stroke when a plot is drawn large. */
const gapBands = (root: Element, W: number, H: number) =>
  bandEls(root).map((b) => [round((parseFloat(b.style.left) * W) / 100), round((parseFloat(b.style.width) * W) / 100), round((parseFloat(b.style.getPropertyValue('--vizgap-top')) * H) / 100)]);
const SPARK = [140, 40] as const;
const PLOT = [320, 140] as const;

describe('Sparkline: null gaps', () => {
  it('breaks the line and the area at a null in the middle, and marks the gap on the baseline', () => {
    const { container } = render(<Sparkline values={[2, 4, null, 4, 2]} />);
    const [area, line] = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d')!);
    expect(subpaths(line)).toBe(2);
    expect(subpaths(area)).toBe(2);
    expect(area.match(/Z/g)).toHaveLength(2);
    expect(line).not.toContain('NaN');
    /* five slots across 132 units: the gap is the middle slot, and no vertex sits on it */
    expect(line).not.toMatch(/[ML]70\.0 /);
    expect(line).toMatch(/^M4\.0 .* L37\.0 [\d.]+ M103\.0 .* L136\.0 /);
    /* never zero: nothing of the line reaches the baseline (y 30 once the band's room is reserved) */
    expect(Math.max(...ys(line))).toBeLessThan(30);
    /* the band covers the null slot only (half a step either side), 2 below the baseline, 4 tall */
    expect(gapBands(container, ...SPARK)).toEqual([[53.5, 33, 32]]);
    /* the band is HTML over the plot, not part of the stretched svg: its hatch keeps its angle */
    const band = bandEls(container)[0];
    expect(band.parentElement!.className).toBe('vizframe');
    expect(band.previousElementSibling!.localName).toBe('svg');
    expect(band.parentElement!.parentElement!.className).toBe('spark');
    expect([...band.attributes].map((a) => a.name).sort()).toEqual(['aria-hidden', 'class', 'style']);
    expect(band.getAttribute('aria-hidden')).toBe('true');
    expect(band.textContent).toBe('');
    expect(container.querySelectorAll('svg line, svg rect, svg pattern')).toHaveLength(0);
  });

  it('draws no stray point for leading and trailing nulls, and marks both gaps', () => {
    const { container } = render(<Sparkline values={[null, 3, 5, null]} area={false} />);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    const line = container.querySelector('path')!.getAttribute('d')!;
    expect(subpaths(line)).toBe(1);
    expect(line).toMatch(/^M48\.0 [\d.]+ L92\.0 [\d.]+$/);
    /* a gap at the start and one at the end: from the plot's edge to the midpoint before the known point */
    expect(gapBands(container, ...SPARK).map((l) => l.slice(0, 2))).toEqual([[4, 22], [114, 22]]);
    const lead = render(<Sparkline values={[null, 3, 5]} area={false} />).container;
    expect(lead.querySelectorAll('circle')).toHaveLength(1);
    expect(lead.querySelector('circle')!.getAttribute('cx')).toBe('136');
  });

  it('keeps a real zero as a value and leaves nulls out of the scale', () => {
    const { container } = render(<Sparkline values={[0, null, 8]} area={false} />);
    const line = container.querySelector('path');
    expect(line).toBeNull();
    const dots = [...container.querySelectorAll('circle')].map((c) => [c.getAttribute('cx'), c.getAttribute('cy')]);
    /* the zero sits on the baseline (30), the band starts 2 below it: they never touch */
    expect(dots).toEqual([['4', '30'], ['136', '4']]);
    expect(gapBands(container, ...SPARK)).toEqual([[37, 66, 32]]);
  });

  it('draws a value alone between two gaps as an r=3 dot, and no empty path', () => {
    const { container } = render(<Sparkline values={[1, null, 2, null, 1]} />);
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelectorAll('linearGradient')).toHaveLength(0);
    const dots = [...container.querySelectorAll('circle')];
    expect(dots.map((c) => c.getAttribute('r'))).toEqual(['3', '3', '3']);
    expect(dots.map((c) => c.getAttribute('cx'))).toEqual(['4', '70', '136']);
    expect(dots[1].getAttribute('cy')).toBe('4');
    expect(dots.map((c) => c.getAttribute('fill'))).toEqual(['var(--data-3)', 'var(--data-3)', 'var(--data-3)']);
  });

  it('emits no empty area path when no run is wide enough to fill', () => {
    const { container } = render(<Sparkline values={[1, null, 3, 4]} />);
    for (const p of container.querySelectorAll('path')) expect(p.getAttribute('d')).not.toBe('');
    expect(container.querySelectorAll('path')).toHaveLength(2);
    const lone = render(<Sparkline values={[1, null, 3]} />).container;
    expect(lone.querySelectorAll('path')).toHaveLength(0);
  });

  it('never runs a band under a known value: an end gap stops at the midpoint to its neighbour', () => {
    const x = (i: number, n: number) => 4 + (132 * i) / (n - 1);
    const cases: [(number | null)[], number[][]][] = [
      [[5, null], [[70, 66, 32]]],
      [[null, 5], [[4, 66, 32]]],
      [[1, null, 3], [[37, 66, 32]]],
      [[null, 3, 4, 5, null], [[4, 16.5, 32], [119.5, 16.5, 32]]],
      [[null, 3, null, null, 5, 6, null], [[4, 11, 32], [37, 44, 32], [125, 11, 32]]],
    ];
    for (const [values, want] of cases) {
      const { container } = render(<Sparkline values={values} area={false} />);
      const got = gapBands(container, ...SPARK);
      expect(got, JSON.stringify(values)).toEqual(want);
      values.forEach((v, i) => {
        if (v === null) return;
        for (const [left, width] of got) expect(x(i, values.length) > left + 0.2 && x(i, values.length) < left + width - 0.2, `${JSON.stringify(values)} at ${i}`).toBe(false);
      });
    }
  });

  it('holds the band clear of the baseline by 2 plot units or --s-1, whichever is larger (CSS takes the max)', () => {
    const band = bandEls(render(<Sparkline values={[2, null, 4]} />).container)[0];
    expect(band.style.getPropertyValue('--vizgap-base')).toBe('75%');
    expect(band.style.getPropertyValue('--vizgap-top')).toBe('80%');
    expect(band.style.top).toBe('');
  });

  it('draws no frame and no band without a gap', () => {
    const { container } = render(<Sparkline values={[1, 3, 2]} />);
    expect(container.querySelectorAll('.vizframe, .vizgap')).toHaveLength(0);
    expect(container.querySelector('.spark')!.firstElementChild!.localName).toBe('svg');
  });

  it('treats NaN as a gap, never as a value', () => {
    const { container } = render(<Sparkline values={[2, 4, NaN, 4, 2]} />);
    const same = render(<Sparkline values={[2, 4, null, 4, 2]} />).container;
    const strip = (h: string) => h.replace(/_r_\w+_/g, 'id');
    expect(strip(container.innerHTML)).toBe(strip(same.innerHTML));
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('marks all nulls as withheld across the whole plot, which an empty array is not', () => {
    const { container } = render(<Sparkline values={[null, null, null]} />);
    expect(container.querySelector('.spark svg')!.children).toHaveLength(0);
    expect(gapBands(container, ...SPARK)).toEqual([[4, 132, 32]]);
    expect(gapBands(render(<Sparkline values={[null]} />).container, ...SPARK)).toEqual([[4, 132, 32]]);
    const empty = render(<Sparkline values={[]} />).container;
    expect(empty.querySelectorAll('.vizframe, .vizgap')).toHaveLength(0);
    expect(empty.innerHTML).not.toBe(container.innerHTML);
  });

  it('names an all-null sparkline withheld in the plot, from vizLabels, and never an empty one', () => {
    const { container } = render(<Sparkline values={[null, null, null]} />);
    const word = container.querySelector('.vizframe > .vizgap-word')!;
    expect(word.textContent).toBe('withheld');
    expect(render(<Sparkline values={[null, null]} vizLabels={{ withheld: 'not shown' }} />).container.querySelector('.vizgap-word')!.textContent).toBe('not shown');
    expect(render(<Sparkline values={[]} />).container.querySelector('.vizgap-word')).toBeNull();
    expect(render(<Sparkline values={[null, 2, null]} />).container.querySelector('.vizgap-word')).toBeNull();
  });

  it('places the band by which indices are null, never by a value', () => {
    const at = (v: number) => bandEls(render(<Sparkline values={[v, null, 7, null, null, v]} />).container).map((b) => b.outerHTML);
    expect(at(987654)).toEqual(at(3));
    expect(at(3)).toHaveLength(2);
  });
});

describe('LineChart: null gaps', () => {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  it('renders two path segments for a null in the middle, in the line and in the area', () => {
    const { container } = render(<LineChart labels={labels} series={[{ name: 'A', values: [2, 4, null, 4, 2] }]} />);
    const line = container.querySelector('path[fill="none"]')!.getAttribute('d')!;
    const area = container.querySelector('path:not([fill="none"])')!.getAttribute('d')!;
    expect(subpaths(line)).toBe(2);
    expect(subpaths(area)).toBe(2);
    expect(area.match(/Z/g)).toHaveLength(2);
    expect(line).not.toMatch(/[ML]160\.0 /);
    expect(line + area).not.toContain('NaN');
    expect(container.querySelectorAll('circle')).toHaveLength(1);
    expect(gapBands(container, ...PLOT)).toEqual([[121.5, 77, 130]]);
    const band = bandEls(container)[0];
    expect(band.parentElement!.className).toBe('vizframe');
    expect(band.parentElement!.parentElement!.className).toBe('vizplot');
    expect(band.parentElement!.firstElementChild!.localName).toBe('svg');
    expect(band.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('svg line, svg rect, svg pattern')).toHaveLength(0);
  });

  it('keeps the dashed second series and its hue alongside nulls in either series', () => {
    const { container } = render(
      <LineChart labels={labels} series={[{ name: 'A', values: [1, null, 3, 4, 5] }, { name: 'B', values: [5, 4, null, null, 1] }]} />,
    );
    const lines = Array.from(container.querySelectorAll('path[fill="none"]'));
    expect(lines).toHaveLength(2);
    expect(lines[0].getAttribute('stroke')).toBe('var(--data-3)');
    expect(lines[0].getAttribute('stroke-dasharray')).toBeNull();
    expect(lines[1].getAttribute('stroke')).toBe('var(--data-alt)');
    expect(lines[1].getAttribute('stroke-dasharray')).toBe('5 4');
    expect(subpaths(lines[0].getAttribute('d')!)).toBe(1);
    expect(subpaths(lines[1].getAttribute('d')!)).toBe(1);
    /* the lone first value of A and the lone last value of B are dots in their series hue */
    expect([...container.querySelectorAll('circle[r="3"]')].map((c) => [c.getAttribute('cx'), c.getAttribute('fill')])).toEqual([
      ['6', 'var(--data-3)'], ['314', 'var(--data-3)'], ['314', 'var(--data-alt)'],
    ]);
    expect(container.querySelectorAll('.vizlegend i')).toHaveLength(2);
    /* bands mark an index, not a series: gaps that touch or overlap across series are ONE band, one hatch */
    expect(gapBands(container, ...PLOT)).toEqual([[44.5, 231, 130]]);
    const apart = render(
      <LineChart labels={labels} series={[{ name: 'A', values: [null, 2, 3, 4, 5] }, { name: 'B', values: [5, 4, 3, null, null] }]} />,
    ).container;
    expect(gapBands(apart, ...PLOT)).toEqual([[6, 38.5, 130], [198.5, 115.5, 130]]);
  });

  it('draws no stray point for leading and trailing nulls', () => {
    const { container } = render(<LineChart labels={labels} series={[{ name: 'A', values: [null, 2, 3, 4, null] }]} />);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    const line = container.querySelector('path[fill="none"]')!.getAttribute('d')!;
    expect(subpaths(line)).toBe(1);
    expect(line).toMatch(/^M83\.0 /);
    expect(line).not.toContain('NaN');
  });

  it('leaves nulls out of the scale and keeps a real zero on the baseline', () => {
    const { container } = render(<LineChart labels={['a', 'b', 'c', 'd']} series={[{ name: 'A', values: [0, 0, null, 8] }]} />);
    const line = container.querySelector('path[fill="none"]')!.getAttribute('d')!;
    /* a series resting on zero beside a gap: its line is on the baseline, the band 2 below, over the null only */
    expect(line).toBe('M6.0 128.0 L108.7 128.0');
    expect(gapBands(container, ...PLOT)).toEqual([[160, 102.7, 130]]);
    expect(container.querySelector('circle')!.getAttribute('cy')).toBe('6');
  });

  it('marks an all-null chart as withheld across the whole plot, which an empty series is not; hover names it', () => {
    const { container } = render(<LineChart labels={labels} series={[{ name: 'A', values: [null, null, null, null, null] }]} />);
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(gapBands(container, ...PLOT)).toEqual([[6, 308, 130]]);
    /* a band alone can read as loading: the all-null chart says the word, in the plot */
    expect(container.querySelector('.vizframe > .vizgap-word')!.textContent).toBe('withheld');
    const two = render(<LineChart labels={labels} vizLabels={{ withheld: 'not shown' }} series={[{ name: 'A', values: [null, null] }, { name: 'B', values: [null, NaN, null] }]} />).container;
    expect(two.querySelectorAll('.vizgap-word')).toHaveLength(1);
    expect(two.querySelector('.vizgap-word')!.textContent).toBe('not shown');
    const empty = render(<LineChart labels={[]} series={[{ name: 'A', values: [] }]} />).container;
    expect(empty.querySelectorAll('.vizframe, .vizgap, .vizgap-word')).toHaveLength(0);
    expect(render(<LineChart labels={labels} series={[]} />).container.querySelectorAll('.vizframe, .vizgap-word')).toHaveLength(0);
    const svg = container.querySelector('.vizplot svg')!;
    stubBox(svg);
    expect(() => move(svg, 160)).not.toThrow();
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toBe('WedA withheld');
  });

  it('marks an all-null series beside a complete one with a full-width band, and keeps it in the legend', () => {
    const full = { name: 'A', values: [1, 2, 3, 4, 5] };
    const { container } = render(<LineChart labels={labels} series={[full, { name: 'B', values: [null, null, null, null, null] }]} />);
    expect(gapBands(container, ...PLOT)).toEqual([[6, 308, 130]]);
    expect(container.querySelectorAll('path[fill="none"]')).toHaveLength(1);
    expect(container.querySelector('.vizlegend')!.textContent).toContain('B');
    expect(container.querySelector('.vizgap-word')).toBeNull();
    /* the complete series gives the band its room: its baseline is the reserved one */
    expect(container.querySelector('path:not([fill="none"])')!.getAttribute('d')).toContain(' 128 ');
  });

  it('draws no frame and no band without a gap, a short second series included', () => {
    const { container } = render(<LineChart labels={labels} series={[{ name: 'A', values: [1, 2, 3, 4, 5] }, { name: 'B', values: [4] }]} />);
    expect(container.querySelectorAll('.vizframe, .vizgap')).toHaveLength(0);
    expect(container.querySelector('.vizplot')!.firstElementChild!.localName).toBe('svg');
  });

  it('places the bands by which indices are null, never by a value', () => {
    const at = (v: number) => bandEls(render(
      <LineChart labels={labels} series={[{ name: 'A', values: [v, null, 7, v, 2] }, { name: 'B', values: [null, v, v, null, null] }]} />,
    ).container).map((b) => b.outerHTML);
    expect(at(987654)).toEqual(at(3));
    expect(at(3)).toHaveLength(2);
  });

  it('shows the withheld word, no value and no hover point for a series that is null at the hovered index', () => {
    const seen: unknown[] = [];
    const { container } = render(
      <LineChart
        labels={labels}
        series={[{ name: 'A', values: [1, 2, null, 4, 5] }, { name: 'B', values: [5, 4, 0, 2, 1] }]}
        format={(v) => { seen.push(v); return `${v} kg`; }}
      />,
    );
    const svg = screen.getByRole('img');
    stubBox(svg);
    move(svg, 160);
    const tip = screen.getByRole('status');
    expect(tip.querySelector('b')!.textContent).toBe('Wed');
    const rows = [...tip.querySelectorAll('span')];
    expect(rows.map((r) => r.textContent)).toEqual(['A withheld', 'B 0 kg']);
    expect(rows.map((r) => r.hasAttribute('data-withheld'))).toEqual([true, false]);
    expect(tip.textContent).not.toMatch(/null|NaN|undefined/);
    expect(seen).not.toContain(null);
    expect(container.querySelectorAll('circle[r="4"]')).toHaveLength(1);
    expect(container.querySelector('circle[r="4"]')!.getAttribute('fill')).toBe('var(--data-alt)');
  });

  it('takes the hover word from vizLabels, and treats NaN as withheld', () => {
    render(<LineChart labels={labels} series={[{ name: 'A', values: [1, 2, NaN, 4, 5] }]} vizLabels={{ withheld: 'Not shown' }} />);
    const svg = screen.getByRole('img');
    stubBox(svg);
    move(svg, 160);
    expect(screen.getByRole('status').textContent).toBe('WedA Not shown');
  });
});
