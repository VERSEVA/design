import { useEffect, useState } from 'react';
import { Button } from '../../../react/button';
import { usePauseMotion } from '../theme';
import { FAMILY_LABEL, Section, Specimen, tokensOf, useLive } from './Specimen';

/** cubic-bezier(x1, y1, x2, y2) as an SVG path in a 100-unit box, y up. */
export function easePath(value: string): string | null {
  const m = value.match(/cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  const p = (x: number, y: number) => `${+(x * 100).toFixed(2)} ${+(100 - y * 100).toFixed(2)}`;
  return `M${p(0, 0)} C${p(x1, y1)} ${p(x2, y2)} ${p(1, 1)}`;
}

export function MotionSection() {
  const live = useLive();
  const still = usePauseMotion();
  const all = tokensOf('motion');
  const durs = all.filter((t) => t.name.startsWith('--dur-'));
  const eases = all.filter((t) => t.name.startsWith('--ease-'));
  const [run, setRun] = useState(false);
  const [gen, setGen] = useState(0);

  useEffect(() => {
    if (gen === 0) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setRun(true)));
    return () => cancelAnimationFrame(id);
  }, [gen]);

  const replay = () => { setRun(false); setGen((g) => g + 1); };

  return (
    <Section id="motion" title="Motion" count={all.length}>
      <div className="fd-group">
        <h3 className="fd-sub">Duration <span className="cnt mono muted">{durs.length}</span></h3>
        <div className="grid">
          {durs.map((t) => <Specimen key={t.name} t={t} value={live(t.name)} />)}
        </div>
      </div>
      <div className="fd-group">
        <div className="fd-subrow">
          <h3 className="fd-sub">{FAMILY_LABEL.motion} curves <span className="cnt mono muted">{eases.length}</span></h3>
          <Button variant="secondary" size="sm" onClick={replay}>Replay</Button>
        </div>
        <div className="grid">
          {eases.map((t) => {
            const value = live(t.name);
            const d = easePath(value);
            return (
              <Specimen key={t.name} t={t} value={value}>
                <svg className="fd-curve" viewBox="-6 -66 112 178" aria-hidden="true">
                  <path className="fd-guide" d="M0 100 L100 0" />
                  <path data-ease={t.name} d={d ?? ''} />
                </svg>
                <span className="fd-track" aria-hidden="true">
                  <span
                    className={`fd-run${run ? ' on' : ''}${still ? ' still' : ''}`}
                    style={{ transitionTimingFunction: `var(${t.name})` }}
                  ><i /></span>
                </span>
              </Specimen>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
