// @vitest-environment node
// Byte-identity for calls written before 1.7.1 (issue 205): the static markup of every chart part,
// for the inputs the kit was already tested with, held against viz-baseline.json. That file was
// written from the kit as it stood before suppressed items and null gaps landed, so a change to
// what an existing call renders fails here. VSV_WRITE_BASELINE=1 rewrites it, on purpose only.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { Sparkline, LineChart, Bars, HBars, Ring, ActivityStrip, Trend } from '../../react/viz';

const labels = ['Mon', 'Tue', 'Wed'];
export const BASELINE: Record<string, React.ReactElement> = {
  'sparkline empty': <Sparkline values={[]} />,
  'sparkline line': <Sparkline values={[1, 3, 2]} area={false} />,
  'sparkline area': <Sparkline values={[1, 3, 2]} />,
  'sparkline one value': <Sparkline values={[4]} />,
  'sparkline zeros and max': <Sparkline values={[0, 5, 0, 12]} max={20} className="mt-2" />,
  'linechart empty': <LineChart labels={[]} series={[{ name: 'A', values: [] }]} />,
  'linechart three series': (
    <LineChart labels={labels} series={[{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [3, 2, 1] }, { name: 'C', values: [2, 2, 2] }]} />
  ),
  'linechart format': <LineChart labels={labels} series={[{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [4, 5, 6] }]} format={(v) => `${v} kg`} />,
  'linechart short second series': <LineChart labels={labels} series={[{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [4] }]} />,
  'linechart reference and zero': (
    <LineChart labels={labels} series={[{ name: 'A', values: [0, 2, 0] }]} reference={{ value: 4, label: 'AVG' }} height={100} className="x" />
  ),
  'bars': <Bars data={[{ label: 'a', value: 5 }, { label: 'b', value: 10, level: 2 }]} />,
  'bars no values, zero, level 0': <Bars data={[{ label: 'a', value: 0, level: 0 }, { label: 'b', value: 3 }]} showValues={false} height={80} className="x" />,
  'bars empty': <Bars data={[]} />,
  'hbars': <HBars data={[{ label: 'x', value: 2 }, { label: 'y', value: 8, alt: true }]} format={(v) => `${v}%`} />,
  'hbars plain and zero': <HBars data={[{ label: 'x', value: 0 }, { label: 'y', value: 3 }]} className="x" />,
  'hbars empty': <HBars data={[]} />,
  'ring': <><Ring value={140} center="Over" /><Ring value={-10} center="Under" sub="left" /></>,
  'activity strip': <ActivityStrip levels={[0, 2, 3]} todayIndex={2} labels={labels} />,
  'trend': <><Trend delta="-4 kg" judgment="good" /><Trend delta="−52 s" judgment="good" /><Trend delta="0" judgment="flat" /><Trend delta="+3" judgment="bad" /></>,
};

const file = path.resolve(__dirname, 'viz-baseline.json');
const now = Object.fromEntries(Object.entries(BASELINE).map(([k, el]) => [k, renderToStaticMarkup(el)]));

describe('viz kit: existing calls render the markup they always did', () => {
  if (process.env.VSV_WRITE_BASELINE === '1') fs.writeFileSync(file, JSON.stringify(now, null, 2) + '\n');
  const held = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
  it('holds every fixture', () => {
    expect(Object.keys(now)).toEqual(Object.keys(held));
  });
  it.each(Object.keys(BASELINE))('%s', (name) => {
    expect(now[name]).toBe(held[name]);
  });
});
