// The studio specimen tile: one tile language for every studio page, in the /widgets
// anatomy. It reuses the package's .wgrid and .wtile parts (glass surface at --r-lg,
// S/M/L/XL spans, header, skeleton, error); tiles.css adds only what a specimen needs
// on top: a heading in the header, content-sized rows, and the code footer.
// Render-safe: nothing touches window, document or storage until a click.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import './tiles.css';

export type TileSize = 's' | 'm' | 'l' | 'xl';

/** A tile that is not showing its specimen. One at a time; loading wins, then error, then empty. */
export interface TileStatus {
  /** Shows the skeleton and marks the tile aria-busy. */
  loading?: boolean;
  /** Shows the message as an alert, with Retry when onRetry is given. */
  error?: string;
  /** Shows the label in place of the specimen, e.g. "No tokens". */
  empty?: string;
}

export interface SpecimenTileProps {
  /** Anchor id on the tile, so a deep link (/components#button) and the On this page rail land on it. */
  id?: string;
  /** The name in the header, the tile's primary label. */
  name: ReactNode;
  /** Heading level of the name: h2 when each tile is a page section, h3 when tiles sit under one. Default h2. */
  level?: 2 | 3;
  /** Header icon, 24-unit stroke SVG, aria-hidden. One icon per category, not per tile. */
  icon?: ReactNode;
  /** Header meta, neutral: a count or a short data label ("8 variants"). Never the accent. */
  meta?: ReactNode;
  /** Bento span: S 1 column, M 2, L 2 by 2 rows, XL the full row. Under 1100px XL takes the 2 columns M does, under 560px every tile takes the one. Default m. */
  size?: TileSize;
  /** The code sample behind Show code, shown exactly as given. A loader keeps large sample sets out of the
      page chunk: it starts on hover or focus of Show code, and the panel shows a skeleton, then the text or Retry.
      Omit for no code footer. */
  code?: string | (() => Promise<string>);
  /** Extra footer controls before Show code, e.g. a Replay button. */
  actions?: ReactNode;
  status?: TileStatus;
  /** The tile that owns the view's data accent (law 3): its viz kit keeps the --data ladder. Every other tile on a
      page of charts sets false, and the package recolours its charts to the text ladder. Default true: a specimen
      page that is not about charts shows each component as it ships. */
  focus?: boolean;
  onRetry?: () => void;
  /** Labels, for translation. */
  labels?: Partial<typeof LABELS>;
  className?: string;
  /** The live specimen. */
  children?: ReactNode;
}

export const LABELS = { show: 'Show code', hide: 'Hide code', copy: 'Copy', copied: 'Copied', copyFailed: 'Select + copy', retry: 'Retry', code: 'Code sample', codeError: 'Code did not load.' };

const ALERT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>;

/** A header icon from path children, in the tile's stroke style. */
export const tileIcon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

function Copy({ code, pre, labels }: { code: string; pre: RefObject<HTMLPreElement | null>; labels: typeof LABELS }) {
  const [said, setSaid] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setSaid(labels.copied);
    } catch {
      /* No clipboard (permissions, http): select the sample so the keyboard copy works. */
      const sel = window.getSelection();
      if (pre.current && sel) { sel.selectAllChildren(pre.current); }
      setSaid(labels.copyFailed);
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaid(null), 1400);
  };
  return (
    <button type="button" className="btn btn-secondary sm stile-copy" onClick={copy}>
      <span aria-live="polite">{said ?? labels.copy}</span>
    </button>
  );
}

/** A sample given as text, or loaded once on first intent; a failed load can be retried. */
function useCode(code: SpecimenTileProps['code']) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const load = () => {
    if (typeof code !== 'function' || loaded != null || pending.current) return;
    pending.current = true;
    setFailed(false);
    code().then(setLoaded, () => setFailed(true)).finally(() => { pending.current = false; });
  };
  return { text: typeof code === 'string' ? code : loaded, failed, load };
}

export function SpecimenTile({ id, name, level = 2, icon, meta, size = 'm', code, actions, status, focus = true, onRetry, labels, className, children }: SpecimenTileProps) {
  const L = { ...LABELS, ...labels };
  const [open, setOpen] = useState(false);
  const pre = useRef<HTMLPreElement>(null);
  const sample = useCode(code);
  const H = level === 2 ? 'h2' : 'h3';
  const codeId = id ? `${id}-code` : undefined;
  const state = status?.loading ? 'loading' : status?.error ? 'error' : status?.empty ? 'empty' : null;

  let body: ReactNode = children;
  if (state === 'loading') {
    body = (
      <div className="wtile-skel" aria-hidden="true">
        <span className="skel wtile-skel-num" />
        {size !== 's' && <span className="skel wtile-skel-plot" />}
      </div>
    );
  } else if (state === 'error') {
    body = (
      <div className="wtile-err" role="alert">
        <span className="wtile-errline">{ALERT}{status!.error}</span>
        {onRetry && <button type="button" className="btn btn-secondary sm" onClick={onRetry}>{L.retry}</button>}
      </div>
    );
  } else if (state === 'empty') {
    body = <div className="stile-empty">{status!.empty}</div>;
  }

  return (
    /* data-focus: a specimen shows its component as it ships, so the viz kit keeps its accent
       here; on a page of charts only the focus tile does (the .wtile neutraliser, law 3). */
    <section id={id} className={['wtile stile', className].filter(Boolean).join(' ')} data-size={size} data-focus={focus ? '' : undefined} data-state={state ?? undefined} aria-busy={state === 'loading' ? true : undefined}>
      <div className="wtile-body">
        <div className="wtile-hd">
          {icon}
          <H className="stile-name">{name}</H>
          {meta != null && <span className="wtile-meta">{meta}</span>}
        </div>
        <div className="stile-spec">{body}</div>
        {(code != null || actions) && !state && (
          <div className="wtile-foot stile-foot">
            {actions}
            {code != null && (
              <button type="button" className="btn btn-ghost sm stile-toggle" aria-expanded={open} aria-controls={open ? codeId : undefined} onPointerEnter={sample.load} onFocus={sample.load} onClick={() => { sample.load(); setOpen((o) => !o); }}>
                {open ? L.hide : L.show}
              </button>
            )}
            {open && sample.text != null && <Copy code={sample.text} pre={pre} labels={L} />}
          </div>
        )}
        {code != null && open && !state && (sample.text != null
          ? <pre ref={pre} id={codeId} className="stile-code" tabIndex={0} aria-label={L.code}><code>{sample.text}</code></pre>
          : sample.failed
            ? (
              <div id={codeId} className="wtile-err stile-code-err" role="alert">
                <span className="wtile-errline">{ALERT}{L.codeError}</span>
                <button type="button" className="btn btn-secondary sm" onClick={sample.load}>{L.retry}</button>
              </div>
            )
            : <div id={codeId} className="stile-code stile-code-wait" aria-busy="true" aria-label={L.code}><span className="skel" /><span className="skel" /><span className="skel" /></div>
        )}
      </div>
    </section>
  );
}

/** The bento grid tiles sit on: the package's .wgrid columns, rows sized to their specimens. */
export function SpecimenGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['wgrid sgrid', className].filter(Boolean).join(' ')}>{children}</div>;
}
