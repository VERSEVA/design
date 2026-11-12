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
