// Asset Library: 3D objects and loops. Labels, counts, file types and sizes only.
import { useMemo, useState } from 'react';
import { FilterChips } from '../../../react/chips';
import { Segmented } from '../../../react/segmented';
import library from '../data/library.json';
import { getTheme } from '../theme';
import { ThreeStage } from '../three/ThreeStage';
import { useThemedThumb } from '../three/thumbs';
import { downloadThemed } from '../three/exportThemed';
import { Dialog } from './Dialog';
import type { LibLoop, LibObject, Library } from './types';
import './library.css';

export const SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'objects', label: '3D objects' },
  { id: 'loops', label: 'Loops' },
];

const MANIFEST = library as unknown as Library;
const ALL = 'all';

function countBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, number>();
  items.forEach((t) => m.set(key(t), (m.get(key(t)) ?? 0) + 1));
  return m;
}
function setChips<T>(items: T[], key: (t: T) => string) {
  return [{ value: ALL, label: 'All', count: items.length }, ...[...countBy(items, key)].map(([value, count]) => ({ value, label: value, count }))];
}

function Dl({ href, label }: { href: string; label: string }) {
  return <a className="btn btn-secondary sm" href={href} download>{label}</a>;
}

/* ---------- 3D objects ---------- */

function ObjectTile({ o, onOpen }: { o: LibObject; onOpen: () => void }) {
  const src = useThemedThumb(o.id, o.glb, o.thumb);
  return (
    <button type="button" className="card lib-tile" aria-label={`Open ${o.title}`} onClick={onOpen}>
      <img src={src} alt={o.title} width={512} height={512} loading="lazy" decoding="async" />
      <span className="lib-meta"><span className="lib-name">{o.title}</span><span className="mono muted">{o.id}</span></span>
    </button>
  );
}

function EditionSeg({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(options.indexOf(value) + step + options.length) % options.length];
    onChange(next);
    const host = e.currentTarget;
    requestAnimationFrame(() => [...host.querySelectorAll('button')].find((b) => b.textContent === next)?.focus());
  };
  return <div onKeyDown={onKeyDown}><Segmented options={options} value={value} onChange={onChange} aria-label="Edition" /></div>;
}

function ObjectDetail({ o, onClose }: { o: LibObject; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const exportNow = async () => {
    setBusy(true);
    try { await downloadThemed(o, getTheme()); } finally { setBusy(false); }
  };
  return (
    <Dialog
      title={o.title}
      onClose={onClose}
      size="lg"
      footer={<>
        <Dl href={o.downloads.png} label="PNG" />
        <Dl href={o.downloads.glb} label="GLB" />
        <button type="button" className="btn btn-secondary sm" aria-busy={busy || undefined} disabled={busy} onClick={exportNow}>
          {busy && <span className="spinner" aria-hidden="true" />}GLB in this theme
        </button>
      </>}
    >
      <ThreeStage className="lib-detail-stage" src={o.glb} label={o.title} thumb={o.thumb} />
      <dl className="lib-facts">
        <div><dt className="mono muted">Family</dt><dd><span className="badge lib-tag">{o.family}</span></dd></div>
        <div><dt className="mono muted">Edition</dt><dd className="mono">{o.edition}</dd></div>
        <div><dt className="mono muted">Uses</dt><dd className="lib-tags">{o.uses.map((u) => <span key={u} className="badge lib-tag">{u}</span>)}</dd></div>
        <div><dt className="mono muted">ID</dt><dd className="mono">{o.id}</dd></div>
      </dl>
    </Dialog>
  );
}

function Objects({ items }: { items: LibObject[] }) {
  const [family, setFamily] = useState(ALL);
  const editions = useMemo(() => ['All', ...[...new Set(items.map((o) => o.edition))].sort()], [items]);
  const [edition, setEdition] = useState('All');
  const [open, setOpen] = useState<LibObject | null>(null);
  const shown = items.filter((o) => (family === ALL || o.family === family) && (edition === 'All' || o.edition === edition));
  return (
    <section id="objects" className="section" aria-labelledby="objects-h">
      <h2 id="objects-h">3D objects <span className="cnt">{shown.length}</span></h2>
      <div className="lib-filters">
        <FilterChips options={setChips(items, (o) => o.family)} selected={[family]} onChange={(v) => setFamily(v[0] ?? ALL)} />
        <EditionSeg options={editions} value={edition} onChange={setEdition} />
      </div>
      <div className="lib-grid">
        {shown.map((o) => <ObjectTile key={o.id} o={o} onOpen={() => setOpen(o)} />)}
      </div>
      {open && <ObjectDetail o={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/* ---------- Loops ---------- */

function Loops({ items }: { items: LibLoop[] }) {
  return (
    <section id="loops" className="section" aria-labelledby="loops-h">
      <h2 id="loops-h">Loops <span className="cnt">{items.length}</span></h2>
      <div className="lib-grid lib-grid-lg">
        {items.map((l) => (
          <div key={l.id + l.motion} className="card lib-loop">
            <ThreeStage src={l.glb} label={l.title} thumb={l.thumb} loop />
            <div className="lib-meta">
              <span className="lib-name">{l.title}</span>
              <span className="mono muted">{l.seconds} s</span>
            </div>
            <div className="lib-dls">
              <Dl href={l.downloads.webm} label="WebM" />
              <Dl href={l.downloads.mp4} label="MP4" />
              <Dl href={l.downloads.glb} label="GLB" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AssetLibraryPage({ data = MANIFEST }: { data?: Library } = {}) {
  return (
    <section className="page lib">
      <h1 className="display">Asset Library</h1>
      <Objects items={data.objects} />
      <Loops items={data.loops} />
    </section>
  );
}
