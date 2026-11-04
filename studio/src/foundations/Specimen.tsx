import { useMemo, type ReactNode } from 'react';
import tokens from '../data/tokens.json';
import { useHydrated, useThemeTick } from '../theme';
import { SpecimenGrid, SpecimenTile, tileIcon, type TileSize } from '../tiles/SpecimenTile';

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

/* One header icon and one bento size per family. */
export const FAMILY_ICON: Record<string, ReactNode> = {
  canvas: tileIcon(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 14h16" /></>),
  accent: tileIcon(<circle cx="12" cy="12" r="7" />),
  status: tileIcon(<><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  data: tileIcon(<><path d="M4 19h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></>),
  material: tileIcon(<><path d="m12 4 8 4-8 4-8-4z" /><path d="m4 12 8 4 8-4M4 16l8 4 8-4" /></>),
  radius: tileIcon(<path d="M5 19V11a6 6 0 0 1 6-6h8" />),
  spacing: tileIcon(<><path d="M4 12h16" /><path d="m7 9-3 3 3 3M17 9l3 3-3 3" /></>),
  layout: tileIcon(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M10 4v16" /></>),
  type: tileIcon(<><path d="M5 6h14M12 6v13" /></>),
  motion: tileIcon(<path d="M4 19c6 0 6-14 16-14" />),
  contrast: tileIcon(<><circle cx="12" cy="12" r="8" /><path d="M12 4v16" /></>),
};
const FAMILY_SIZE: Record<string, TileSize> = { radius: 'm', spacing: 'm' };

/** The family's declarations as tokens.css writes them: :root, then the light flip for what changes. */
export function tokenCss(list: Token[]): string {
  const block = (sel: string, rows: string[]) => `${sel} {\n${rows.join('\n')}\n}`;
  const flips = list.filter((t) => t.light !== t.dark);
  return [
    block(':root', list.map((t) => `  ${t.name}: ${t.dark};`)),
    ...(flips.length ? [block('[data-theme="light"]', flips.map((t) => `  ${t.name}: ${t.light};`))] : []),
  ].join('\n');
}

export const tokensOf = (...families: string[]): Token[] => tokens.filter((t) => families.includes(t.family));

const declared = (name: string) => (tokens.find((t) => t.name === name) as { dark?: string } | undefined)?.dark ?? '';

/** Live values from the computed style of <html>, re-read on every vsv-theme flip.
    Before mount (pre-render, hydration) it reads the declared dark value instead. */
export function useLive(): (name: string) => string {
  const tick = useThemeTick();
  const live = useHydrated();
  return useMemo(() => {
    if (!live) return declared;
    const style = getComputedStyle(document.documentElement);
    return (name: string) => style.getPropertyValue(name).trim();
  }, [tick, live]);
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
    <div className="fd-spec" data-token={t.name}>
      {children ?? <Visual t={t} />}
      <span className="mono fd-name">{t.name}</span>
      <span className="mono muted fd-value">{value}</span>
    </div>
  );
}

export function Group({ family, size, children }: { family: string; size?: TileSize; children?: ReactNode }) {
  const live = useLive();
  const list = tokensOf(family);
  return (
    <SpecimenTile name={FAMILY_LABEL[family]} level={3} icon={FAMILY_ICON[family]} meta={`${list.length} tokens`} size={size ?? FAMILY_SIZE[family] ?? 'xl'} code={tokenCss(list)}>
      <div className="fd-cells">
        {children ?? list.map((t) => <Specimen key={t.name} t={t} value={live(t.name)} />)}
      </div>
    </SpecimenTile>
  );
}

export function Section({ id, title, count, children }: { id: string; title: string; count: number; children: ReactNode }) {
  return (
    <section id={id} className="section">
      <h2>{title} <span className="cnt">{count}</span></h2>
      <SpecimenGrid>{children}</SpecimenGrid>
    </section>
  );
}
