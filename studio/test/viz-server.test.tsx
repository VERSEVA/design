// @vitest-environment node
// Bars and HBars carry no state, so they must stay renderable where there is no client boundary. Under the
// react-server condition React has no useEffect or useState: a hook in either part throws there. This file
// resolves `react` to that build and calls both parts the way a server render does.
import { describe, it, expect, vi } from 'vitest';
import type * as ReactNS from 'react';

vi.mock('react', async () => {
  // @ts-expect-error the server build ships no types
  const mod = await import('../node_modules/react/react.react-server.js');
  return { ...mod, default: mod };
});

type El = { type: unknown; props: { children?: unknown; className?: string; title?: string } };
const flat = (node: unknown): El[] => {
  if (Array.isArray(node)) return node.flatMap(flat);
  if (!node || typeof node !== 'object') return [];
  const el = node as El;
  return [el, ...flat(el.props?.children)];
};

describe('Bars and HBars under the react-server condition', () => {
  it('resolves react to the server build, which has no effect or state hooks', async () => {
    // @ts-expect-error the server build ships no types
    const server = (await import('../node_modules/react/react.react-server.js')) as Partial<typeof ReactNS>;
    expect(server.useEffect).toBeUndefined();
    expect(server.useState).toBeUndefined();
    const React = (await import('react')) as typeof ReactNS;
    expect(React.useId).toBe(server.useId);
    expect(() => React.useEffect).toThrow();
  });

  it('renders both, suppressed items and a missing display included, without a hook', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { Bars, HBars } = await import('../../react/viz');
    const data = [
      { label: 'a', value: 5 },
      { label: 'b', value: 3, display: '<5', suppressed: true as const },
      { label: 'c', value: 3, suppressed: true } as unknown as { label: string; value: number },
    ];
    const bars = flat(Bars({ data }));
    expect(bars.filter((e) => e.props.className === 'bar').map((e) => e.props.title)).toEqual(['a: 5', 'b: <5', 'c: withheld']);
    expect(bars.filter((e) => e.props.className === 'vtrack')).toHaveLength(2);
    const rows = flat(HBars({ data }));
    expect(rows.filter((e) => e.props.className === 'hbar').map((e) => e.props.title)).toEqual(['a: 5', 'b: <5', 'c: withheld']);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('stops recording new missing-display warnings at a small cap, so a long-lived server does not grow', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { Bars } = await import('../../react/viz');
    for (let i = 0; i < 200; i++) Bars({ data: [{ label: `row ${i}`, value: 1, suppressed: true } as unknown as { label: string; value: number }] });
    expect(warn.mock.calls.length).toBeGreaterThan(0);
    expect(warn.mock.calls.length).toBeLessThanOrEqual(50);
    warn.mockRestore();
  });
});
