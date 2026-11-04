import { useMemo } from 'react';
import { Badge } from '../../../react/badge';
import { evaluatePairs, pendingPairs } from '../contrast';
import { useHydrated, useThemeTick } from '../theme';
import { SpecimenTile } from '../tiles/SpecimenTile';
import { FAMILY_ICON, Section } from './Specimen';

export function ContrastSection() {
  const tick = useThemeTick();
  const live = useHydrated();
  /* Ratios are measured on the live page, so the pre-render lists the pairs unmeasured. */
  const rows = useMemo(() => (live ? evaluatePairs(document.documentElement) : pendingPairs()), [tick, live]);
  const failing = live ? rows.filter((r) => !r.pass).length : 0;
  return (
    <Section id="contrast" title="Contrast" count={rows.length}>
      <SpecimenTile name="Pairs" level={3} icon={FAMILY_ICON.contrast} meta={live ? `${rows.length - failing} of ${rows.length} pass` : `${rows.length} pairs`} size="xl">
        <div className="fd-scroll">
          <table className="table fd-table">
            <thead>
              <tr><th>Pair</th><th className="num">Ratio</th><th className="num">Floor</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.fg} ${r.bg}`} data-pair={`${r.fg}/${r.bg}`}>
                  <td className="mono">{r.fg} on {r.bg}</td>
                  <td className="num mono">{live ? r.ratio.toFixed(2) : ''}</td>
                  <td className="num mono">{r.floor}</td>
                  <td>{live && <Badge tone={r.pass ? 'ok' : 'err'}>{r.pass ? 'Pass' : 'Fail'}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SpecimenTile>
      {failing > 0 && <span className="sr-only" role="status">{failing} failing</span>}
    </Section>
  );
}
