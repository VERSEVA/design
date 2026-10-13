// Front door: hero picker, live readout, the surfaces stage, counts, install.
import { useEffect, useRef, useState } from 'react';
import { ThemePicker } from '../shell/ThemePicker';
import { ThreeStage } from '../three/ThreeStage';
import { ratio, type RGB } from '../contrast';
import { BRANDS, useTheme, useThemeTick } from '../theme';
import { watchFrames } from './frameSync';
import tokens from '../data/tokens.json';
import library from '../data/library.json';
import './front.css';

export const SECTIONS: ReadonlyArray<{ id: string; label: string }> = [];

const INSTALL = 'npm i @verseva/design';
const ROWS = ['--bg', '--surface', '--text-1', '--text-2', '--accent', '--data-alt'] as const;
const OBJECTS = [
  { stem: 'VSV-016_partnership-links__linked-sway', label: 'Partnership links loop', tag: 'live loop', loop: true, w: 'w2' },
  { stem: 'VSV-001', label: 'Stone portal', tag: 'live GLB', loop: false, w: 'w3' },
  { stem: 'VSV-019', label: 'Rising arc', tag: 'live GLB', loop: false, w: 'w3' },
] as const;

const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
const lib = library as Partial<Record<'objects' | 'loops', unknown>>;
/* hex, contrast, spacing, type: the four bin/*-gate.mjs checks that fail builds */
const GATES = 4;
const COUNTS = [
  { label: 'Tokens', n: len(tokens) },
  { label: 'Themes', n: BRANDS.length },
  { label: '3D objects', n: len(lib.objects) },
  { label: 'Loops', n: len(lib.loops) },
  { label: 'Gates', n: GATES },
];

const parse = (c: string): RGB | null => {
  const m = c.match(/[\d.]+/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : null;
};
const toHex = (c: RGB | null) => (c ? '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() : '');
const fmt = (a: RGB | null, b: RGB | null) => (a && b ? ratio(a, b).toFixed(2) : '');

interface Readout { values: Record<string, RGB | null>; inkOnAccent: number }

function readTokens(): Readout {
  const probe = document.createElement('i');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const values: Record<string, RGB | null> = {};
  for (const v of [...ROWS, '--accent-ink']) {
    probe.style.color = `var(${v})`;
    values[v] = parse(getComputedStyle(probe).color);
  }
  probe.remove();
  const ink = values['--accent-ink'], acc = values['--accent'];
  return { values, inkOnAccent: ink && acc ? ratio(ink, acc) : 0 };
}

function useReadout(): Readout {
  const theme = useTheme();
  const tick = useThemeTick();
  const [r, setR] = useState<Readout>(() => ({ values: {}, inkOnAccent: 0 }));
  useEffect(() => { setR(readTokens()); }, [theme.brand, theme.mode, tick]);
  return r;
}

function CopyInstall() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = () => {
    navigator.clipboard?.writeText(INSTALL).catch(() => {});
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="install">
      <code>{INSTALL}</code>
      <button type="button" className="btn btn-secondary lg" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      <span className="sr-only" aria-live="polite">{copied ? 'Copied' : ''}</span>
    </div>
  );
}

function FrameTile({ src, title, kind, w }: { src: string; title: string; kind: string; w: string }) {
  return (
    <div className={`card tile ${w}`}>
      <div className="frame" inert><iframe src={src} title={title} loading="lazy" tabIndex={-1} /></div>
      <a className="cover" href={src} aria-label={`Open ${title}`} />
      <span className="badge tag"><b>{title}</b>{kind}</span>
    </div>
  );
}

export function FrontDoorPage() {
  const { values, inkOnAccent } = useReadout();
  const stage = useRef<HTMLElement>(null);
  useEffect(() => (stage.current ? watchFrames(stage.current) : undefined), []);
  const aa = inkOnAccent >= 4.5;

  return (
    <div className="page front">
      <section className="hero">
        <h1 className="display">One source. Every surface</h1>
        <ThemePicker size="lg" />
        <div className="chiprow readout">
          <span className="badge neutral">--accent <code>{toHex(values['--accent'] ?? null)}</code></span>
          <span className="badge neutral">
            ink on accent <code>{inkOnAccent.toFixed(2)}</code>
            <span className={`badge ${aa ? 'ok' : 'err'}`}>{aa ? 'AA' : 'Fail'}</span>
          </span>
          <span className="badge neutral">text on bg <code>{fmt(values['--text-1'] ?? null, values['--bg'] ?? null)}</code></span>
        </div>
      </section>

      <section className="stage" aria-label="Surfaces" ref={stage}>
        <FrameTile src="/examples/pulse.html" title="Pulse" kind="dashboard" w="w4" />
        <FrameTile src="/examples/launch.html" title="Launch" kind="landing" w="w2" />
        <div className="card tile w2">
          <div className="deck">
            <span className="k">Q3 review · 04</span>
            <h3>Throughput doubled where the queue was cut</h3>
            <div className="bars" aria-hidden="true">
              <span style={{ height: '38%' }} /><span style={{ height: '46%' }} /><span style={{ height: '52%' }} /><span className="on" style={{ height: '94%' }} />
            </div>
          </div>
          <span className="badge tag"><b>Deck</b>slide</span>
        </div>
        {OBJECTS.slice(0, 1).map((o) => <ObjectTile key={o.stem} {...o} />)}
        <div className="card tile w2">
          <div className="tok">
            {ROWS.map((v) => (
              <div className="row" key={v}>
                <i style={{ background: `var(${v})` }} aria-hidden="true" />
                <code>{v}</code>
                <span className="v">{toHex(values[v] ?? null)}</span>
              </div>
            ))}
            <div className="pair"><span>--text-2 / --surface</span><span className="v">{fmt(values['--text-2'] ?? null, values['--surface'] ?? null)}</span></div>
          </div>
          <span className="badge tag"><b>Tokens</b>live</span>
        </div>
        {OBJECTS.slice(1).map((o) => <ObjectTile key={o.stem} {...o} />)}
      </section>

      <section className="counts">
        <div className="statrow">
          {COUNTS.map((c) => (
            <div className="stat" key={c.label}><div className="num">{c.n}</div><div className="lbl">{c.label}</div></div>
          ))}
        </div>
        <CopyInstall />
      </section>
    </div>
  );
}

function ObjectTile({ stem, label, tag, loop, w }: (typeof OBJECTS)[number]) {
  const id = stem.split('_')[0];
  return (
    <div className={`card tile ${w}`}>
      <div className="obj">
        <ThreeStage src={`/library/glb/${stem}.glb`} label={label} loop={loop} thumb={`/library/thumb/${stem}.webp`} />
      </div>
      <span className="badge tag"><b>{id}</b>{tag}</span>
    </div>
  );
}
