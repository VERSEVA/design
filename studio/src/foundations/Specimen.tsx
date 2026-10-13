import { useMemo, type ReactNode } from 'react';
import tokens from '../data/tokens.json';
import { useThemeTick } from '../theme';

export type Token = (typeof tokens)[number];

export const FAMILY_LABEL: Record<string, string> = {
  canvas: 'Canvas and text',
  accent: 'Accent',
  status: 'Status',
  data: 'Data',
  material: 'Material and elevation',
  radius: 'Radius',
  spacing: 'Spacing',
  type: 'Type',
  motion: 'Motion',
  layout: 'Layout',
};

export const tokensOf = (...families: string[]): Token[] => tokens.filter((t) => families.includes(t.family));

/** Live values from the computed style of <html>, re-read on every vsv-theme flip. */
export function useLive(): (name: string) => string {
  const tick = useThemeTick();
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    return (name: string) => style.getPropertyValue(name).trim();
  }, [tick]);
}

type Kind = 'color' | 'image' | 'shadow' | 'radius' | 'space' | 'font' | 'weight' | 'value';

function kindOf(t: Token): Kind {
  const n = t.name;
  if (/^--(e-\d+|glass-(shadow|glow|inset)|nav-pill-inset|accent-active-glow)$/.test(n)) return 'shadow';
  if (n === '--surface-body' || n === '--accent-bloom') return 'image';
  if (t.family === 'radius') return 'radius';
  if (t.family === 'spacing' || n === '--nav-gap') return 'space';
  if (/^--font-/.test(n)) return 'font';
  if (/-weight$/.test(n)) return 'weight';
  if (/^--(glass-(blur|sat)|container-|dur-|ease-)/.test(n)) return 'value';
  return 'color';
}

function Visual({ t }: { t: Token }) {
  const v = `var(${t.name})`;
  switch (kindOf(t)) {
    case 'color': return <span className="fd-swatch" style={{ background: v }} aria-hidden="true" />;
    case 'image': return <span className="fd-swatch" style={{ backgroundImage: v }} aria-hidden="true" />;
    case 'shadow': return <span className="fd-box" style={{ boxShadow: v }} aria-hidden="true" />;
    case 'radius': return <span className="fd-box" style={{ borderRadius: v }} aria-hidden="true" />;
    case 'space': return <span className="fd-bar" style={{ width: v }} aria-hidden="true" />;
    case 'font': return <span className="fd-glyph" style={{ fontFamily: v }} aria-hidden="true">Aa</span>;
    case 'weight': return <span className="fd-glyph" style={{ fontWeight: v }} aria-hidden="true">Aa</span>;
    default: return null;
  }
}

export function Specimen({ t, value, children }: { t: Token; value: string; children?: ReactNode }) {
  return (
    <div className="card fd-spec" data-token={t.name}>
      {children ?? <Visual t={t} />}
      <span className="mono fd-name">{t.name}</span>
      <span className="mono muted fd-value">{value}</span>
    </div>
  );
}

export function Group({ family, children }: { family: string; children?: ReactNode }) {
  const live = useLive();
  const list = tokensOf(family);
  return (
    <div className="fd-group">
      <h3 className="fd-sub">{FAMILY_LABEL[family]} <span className="cnt mono muted">{list.length}</span></h3>
      <div className="grid">
        {children ?? list.map((t) => <Specimen key={t.name} t={t} value={live(t.name)} />)}
      </div>
    </div>
  );
}

export function Section({ id, title, count, children }: { id: string; title: string; count: number; children: ReactNode }) {
  return (
    <section id={id} className="section">
      <h2>{title} <span className="cnt">{count}</span></h2>
      {children}
    </section>
  );
}
