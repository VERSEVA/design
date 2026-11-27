// @vitest-environment node
// Byte-identity for calls written before 1.7.1 (issue 205): the static markup of every chart part,
// for the inputs the kit was already tested with, held against viz-baseline.json. That file was
// written from the kit as it stood before suppressed items and null gaps landed, so a change to
// what an existing call renders fails here. VSV_WRITE_BASELINE=1 rewrites it, on purpose only.
// The hidden data table (issue 206) is on by default; `table={false}` is the opt-out, and it renders
// exactly the markup these calls rendered before the table existed.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { Sparkline, LineChart, Bars, HBars, Ring, ActivityStrip, Trend } from '../../react/viz';

const labels = ['Mon', 'Tue', 'Wed'];
export const BASELINE: Record<string, React.ReactElement> = {
  'sparkline empty': <Sparkline table={false} values={[]} />,
  'sparkline line': <Sparkline table={false} values={[1, 3, 2]} area={false} />,
  'sparkline area': <Sparkline table={false} values={[1, 3, 2]} />,
  'sparkline one value': <Sparkline table={false} values={[4]} />,
  'sparkline zeros and max': <Sparkline table={false} values={[0, 5, 0, 12]} max={20} className="mt-2" />,
  'linechart empty': <LineChart table={false} labels={[]} series={[{ name: 'A', values: [] }]} />,
  'linechart three series': (
    <LineChart table={false} labels={labels} series={[{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [3, 2, 1] }, { name: 'C', values: [2, 2, 2] }]} />
  ),
  'linechart format': <LineChart table={false} labels={labels} series={[{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [4, 5, 6] }]} format={(v) => `${v} kg`} />,
  'linechart short second series': <LineChart table={false} labels={labels} series={[{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [4] }]} />,
  'linechart reference and zero': (
    <LineChart table={false} labels={labels} series={[{ name: 'A', values: [0, 2, 0] }]} reference={{ value: 4, label: 'AVG' }} height={100} className="x" />
  ),
  'bars': <Bars table={false} data={[{ label: 'a', value: 5 }, { label: 'b', value: 10, level: 2 }]} />,
  'bars no values, zero, level 0': <Bars table={false} data={[{ label: 'a', value: 0, level: 0 }, { label: 'b', value: 3 }]} showValues={false} height={80} className="x" />,
  'bars empty': <Bars table={false} data={[]} />,
  'hbars': <HBars table={false} data={[{ label: 'x', value: 2 }, { label: 'y', value: 8, alt: true }]} format={(v) => `${v}%`} />,
  'hbars plain and zero': <HBars table={false} data={[{ label: 'x', value: 0 }, { label: 'y', value: 3 }]} className="x" />,
  'hbars empty': <HBars table={false} data={[]} />,
  'ring': <><Ring value={140} center="Over" /><Ring value={-10} center="Under" sub="left" /></>,
  'activity strip': <ActivityStrip levels={[0, 2, 3]} todayIndex={2} labels={labels} />,
  'trend': <><Trend delta="-4 kg" judgment="good" /><Trend delta="−52 s" judgment="good" /><Trend delta="0" judgment="flat" /><Trend delta="+3" judgment="bad" /></>,
  /* Issue 194: the same parts with the table on, suppressed items and gaps, written from the kit before `cap` existed. */
  'table on: sparkline gaps': <Sparkline values={[1, null, 3, 2]} label="Visits" />,
  'table on: linechart two series, gaps, reference': (
    <LineChart labels={['W1', 'W2', 'W3', 'W4', 'W5', 'W6']} series={[{ name: 'A', values: [1, 2, null, 4, 5, 6] }, { name: 'B', values: [6, 5, 4] }]}
      reference={{ value: 3, label: 'AVG' }} format={(v) => `${v} kg`} label="Weekly" />
  ),
  'table on: linechart three series': <LineChart labels={labels} series={[{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [3, 2, 1] }, { name: 'C', values: [2, 2, 2] }]} />,
  'table on: bars six items, suppressed, display, level': (
    <Bars label="By day" data={[{ label: 'a', value: 5 }, { label: 'b', value: 10, level: 2 }, { label: 'c', value: 0, suppressed: true, display: '<5' },
      { label: 'd', value: 7, display: '7+' }, { label: 'e', value: 3 }, { label: 'f', value: 9 }]} />
  ),
  'table on: hbars six items, suppressed, alt': (
    <HBars label="By source" format={(v) => `${v}%`} data={[{ label: 'u', value: 20 }, { label: 'v', value: 0, suppressed: true, display: '<5' },
      { label: 'w', value: 12, alt: true }, { label: 'x', value: 8 }, { label: 'y', value: 6 }, { label: '(other)', value: 9, alt: true }]} />
  ),
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
