import { describe, it, expect } from 'vitest';
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
   value small and then huge, and hold the two documents identical. */
describe('Bars: suppressed items and display', () => {
  const data = (secret: number) => [
    { label: 'a', value: 5 },
    { label: 'b', value: secret, display: '<5', suppressed: true, level: 3 as const },
    { label: 'c', value: 10 },
  ];

  it('draws the empty track with no fill and prints display', () => {
    const { container } = render(<Bars data={data(3)} />);
    const bar = container.querySelectorAll<HTMLElement>('.bar')[1];
    expect(bar.querySelector('.fill')).toBeNull();
    expect(bar.querySelectorAll('.vtrack')).toHaveLength(1);
    expect(bar.querySelector('.vtrack')!.getAttribute('style')).toBeNull();
    expect(bar.querySelector('.vlab')!.textContent).toBe('<5');
    expect(bar.querySelector('.vlab')!.hasAttribute('data-display')).toBe(true);
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
    const low = render(<Bars data={data(1)} />).container.innerHTML;
    const high = render(<Bars data={data(987654)} />).container.innerHTML;
    expect(high).toBe(low);
    expect(high).not.toContain('987654');
    const quiet = render(<Bars data={data(987654)} showValues={false} />).container;
    expect(quiet.innerHTML).not.toContain('987654');
    expect(quiet.querySelector('.vlab')).toBeNull();
  });

  it('falls back to a placeholder, never the value, when a suppressed item has no display', () => {
    const { container } = render(<Bars data={[{ label: 'a', value: 4242, suppressed: true }, { label: 'b', value: 2 }]} />);
    expect(container.innerHTML).not.toContain('4242');
    expect(container.querySelector('.vlab')!.textContent).toBe('n/a');
    expect(container.querySelector('.bar')!.getAttribute('title')).toBe('a: n/a');
    expect(container.querySelector<HTMLElement>('.fill')!.style.height).toBe('100%');
  });

  it('keeps the fill when only display is given, and prints display in place of the value', () => {
    const { container } = render(<Bars data={[{ label: 'a', value: 1200, display: '1.2k' }, { label: 'b', value: 2400 }]} />);
    const bars = container.querySelectorAll<HTMLElement>('.bar');
    expect(bars[0].querySelector<HTMLElement>('.fill')!.style.height).toBe('50%');
    expect(bars[0].querySelector('.vtrack')).toBeNull();
    expect(bars[0].hasAttribute('data-suppressed')).toBe(false);
    expect(bars[0].querySelector('.vlab')!.textContent).toBe('1.2k');
    expect(bars[0].querySelector('.vlab')!.hasAttribute('data-display')).toBe(true);
    expect(bars[1].querySelector('.vlab')!.hasAttribute('data-display')).toBe(false);
  });

  it('does not throw when every item is suppressed', () => {
    const { container } = render(<Bars data={[{ label: 'a', value: 3, suppressed: true }]} />);
    expect(container.querySelectorAll('.fill')).toHaveLength(0);
    expect(container.querySelectorAll('.vtrack')).toHaveLength(1);
  });
});

describe('HBars: suppressed items and display', () => {
  const data = (secret: number) => [
    { label: 'x', value: 2 },
    { label: 'y', value: secret, display: '<5', suppressed: true, alt: true },
    { label: 'z', value: 8, alt: true },
  ];

  it('draws the track with nothing in it and prints display, unformatted', () => {
    const { container } = render(<HBars data={data(3)} format={(v) => `${v}%`} />);
    const row = container.querySelectorAll<HTMLElement>('.hbar')[1];
    expect(row.querySelectorAll('.htrack')).toHaveLength(1);
    expect(row.querySelector('.htrack')!.children).toHaveLength(0);
    expect(row.querySelector('.hcount')!.textContent).toBe('<5');
    expect(row.querySelector('.hcount')!.hasAttribute('data-display')).toBe(true);
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
    const low = render(<HBars data={data(1)} format={format} />).container.innerHTML;
    const high = render(<HBars data={data(987654)} format={format} />).container.innerHTML;
    expect(high).toBe(low);
    expect(high).not.toContain('987654');
    expect(seen).not.toContain(987654);
    expect(seen).not.toContain(1);
  });

  it('falls back to a placeholder, never the value, when a suppressed item has no display', () => {
    const { container } = render(<HBars data={[{ label: 'x', value: 4242, suppressed: true }, { label: 'y', value: 2 }]} />);
    expect(container.innerHTML).not.toContain('4242');
    expect(container.querySelector('.hcount')!.textContent).toBe('n/a');
  });

  it('keeps the fill when only display is given, and prints display in place of the formatted value', () => {
    const { container } = render(<HBars data={[{ label: 'x', value: 1200, display: '1.2k' }, { label: 'y', value: 2400 }]} format={(v) => `${v} u`} />);
    const rows = container.querySelectorAll<HTMLElement>('.hbar');
    expect(rows[0].querySelector<HTMLElement>('.htrack i')!.style.width).toBe('50%');
    expect(rows[0].querySelector('.hcount')!.textContent).toBe('1.2k');
    expect(rows[0].getAttribute('title')).toBe('x: 1.2k');
    expect(rows[1].querySelector('.hcount')!.textContent).toBe('2400 u');
    expect(rows[1].querySelector('.hcount')!.hasAttribute('data-display')).toBe(false);
  });
});

/* A null is a gap: the line breaks, no point is drawn there, and it is never zero or bridged. */
const subpaths = (d: string) => d.split('M').filter(Boolean).length;
const ys = (d: string) => [...d.matchAll(/[ML]?\s*(-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));

describe('Sparkline: null gaps', () => {
  it('breaks the line and the area at a null in the middle', () => {
    const { container } = render(<Sparkline values={[2, 4, null, 4, 2]} />);
    const [area, line] = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d')!);
    expect(subpaths(line)).toBe(2);
    expect(subpaths(area)).toBe(2);
    expect(area.match(/Z/g)).toHaveLength(2);
    expect(line).not.toContain('NaN');
    /* five slots across 132 units: the gap is the middle slot, and no vertex sits on it */
    expect(line).not.toMatch(/[ML]70\.0 /);
    expect(line).toMatch(/^M4\.0 .* L37\.0 [\d.]+ M103\.0 .* L136\.0 /);
    /* never zero: nothing is drawn down at the baseline for the gap */
    expect(Math.max(...ys(line))).toBeLessThan(36);
  });

  it('draws no stray point for leading and trailing nulls', () => {
    const { container } = render(<Sparkline values={[null, 3, 5, null]} area={false} />);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    const line = container.querySelector('path')!.getAttribute('d')!;
    expect(subpaths(line)).toBe(1);
    expect(line).toMatch(/^M48\.0 [\d.]+ L92\.0 [\d.]+$/);
    const lead = render(<Sparkline values={[null, 3, 5]} area={false} />).container;
    expect(lead.querySelectorAll('circle')).toHaveLength(1);
    expect(lead.querySelector('circle')!.getAttribute('cx')).toBe('136');
  });

  it('keeps a real zero as a value and leaves nulls out of the scale', () => {
    const { container } = render(<Sparkline values={[0, null, 8]} area={false} />);
    const line = container.querySelector('path')!.getAttribute('d')!;
    expect(line).toContain('M4.0 36.0');
    expect(line).toContain('136.0 4.0');
  });

  it('marks a value alone between two gaps, which a bare move would not draw', () => {
    const { container } = render(<Sparkline values={[1, null, 2, null, 1]} />);
    const [area, line] = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d')!);
    expect(subpaths(line)).toBe(3);
    expect(line).toContain('M70.0 4.0 L70.0 4.0');
    expect(area).not.toContain('NaN');
  });

  it('renders the empty state for all nulls, without throwing', () => {
    const { container } = render(<Sparkline values={[null, null, null]} />);
    expect(container.querySelector('.spark svg')).not.toBeNull();
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(container.querySelectorAll('defs')).toHaveLength(0);
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
    expect(subpaths(lines[0].getAttribute('d')!)).toBe(2);
    expect(subpaths(lines[1].getAttribute('d')!)).toBe(2);
    expect(container.querySelectorAll('.vizlegend i')).toHaveLength(2);
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
    const { container } = render(<LineChart labels={['a', 'b', 'c']} series={[{ name: 'A', values: [0, null, 8] }]} />);
    const line = container.querySelector('path[fill="none"]')!.getAttribute('d')!;
    expect(line).toContain('M6.0 134.0');
    expect(line).toContain('314.0 6.0');
  });

  it('renders the empty state for an all-null series, hover included, without throwing', () => {
    const { container } = render(<LineChart labels={labels} series={[{ name: 'A', values: [null, null, null, null, null] }]} />);
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    const svg = container.querySelector('.vizplot svg')!;
    stubBox(svg);
    expect(() => move(svg, 160)).not.toThrow();
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toBe('Wed');
  });

  it('shows no value and no hover point for a series that is null at the hovered index', () => {
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
    expect(tip.textContent).not.toContain('A');
    expect(tip.textContent).toContain('B 0 kg');
    expect(tip.textContent).not.toMatch(/null|NaN|undefined/);
    expect(seen).not.toContain(null);
    expect(container.querySelectorAll('circle[r="4"]')).toHaveLength(1);
    expect(container.querySelector('circle[r="4"]')!.getAttribute('fill')).toBe('var(--data-alt)');
  });
});
