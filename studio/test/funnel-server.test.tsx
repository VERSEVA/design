// @vitest-environment node
// The step funnel carries no state, so it must render where there is no client boundary. Under the
// react-server condition React has no useEffect or useState: a hook in the part throws there.
import { describe, it, expect, vi } from 'vitest';

vi.mock('react', async () => {
  // @ts-expect-error the server build ships no types
  const mod = await import('../node_modules/react/react.react-server.js');
  return { ...mod, default: mod };
});

type El = { type: unknown; props: { children?: unknown; className?: string } };
const flat = (node: unknown): El[] => {
  if (Array.isArray(node)) return node.flatMap(flat);
  if (!node || typeof node !== 'object') return [];
  const el = node as El;
  return [el, ...flat(el.props?.children)];
};

describe('Funnel under the react-server condition', () => {
  it('renders every state without a hook', async () => {
    const { Funnel } = await import('../../react/funnel');
    const steps = [{ label: 'a', value: 10 }, { label: 'b', value: 4 }, { label: 'c', value: 3, display: '<5', suppressed: true as const }];
    const els = flat(Funnel({ steps, share: true }));
    expect(els.filter((e) => e.props.className === 'hbar')).toHaveLength(3);
    expect(els.filter((e) => e.type === 'table')).toHaveLength(1);
    expect(flat(Funnel({ steps: [], loading: true })).filter((e) => e.props.className === 'hbar')).toHaveLength(5);
    expect(flat(Funnel({ steps: [] })).filter((e) => e.props.className === 'empty')).toHaveLength(1);
  });
});
