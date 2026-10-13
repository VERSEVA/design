import { useMemo } from 'react';
import { Badge } from '../../../react/badge';
import { evaluatePairs } from '../contrast';
import { useThemeTick } from '../theme';
import { Section } from './Specimen';

export function ContrastSection() {
  const tick = useThemeTick();
  const rows = useMemo(() => evaluatePairs(document.documentElement), [tick]);
  const failing = rows.filter((r) => !r.pass).length;
  return (
    <Section id="contrast" title="Contrast" count={rows.length}>
      <div className="fd-scroll">
        <table className="table fd-table">
          <thead>
            <tr><th>Pair</th><th className="num">Ratio</th><th className="num">Floor</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.fg} ${r.bg}`} data-pair={`${r.fg}/${r.bg}`}>
                <td className="mono">{r.fg} on {r.bg}</td>
                <td className="num mono">{r.ratio.toFixed(2)}</td>
                <td className="num mono">{r.floor}</td>
                <td><Badge tone={r.pass ? 'ok' : 'err'}>{r.pass ? 'Pass' : 'Fail'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {failing > 0 && <span className="sr-only" role="status">{failing} failing</span>}
    </Section>
  );
}
