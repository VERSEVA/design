// Home (/): the headline, Get started + Browse, a live widget home on the package parts (L1),
// a neutral drift behind it (L2), and four entry tiles. Labels and data only.
// Pre-render: everything renders still; motion and ticking start after mount, and stop under
// Pause motion (WCAG 2.2.2) and reduced motion.
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { WidgetGrid } from '../../../react/widget-grid';
import type { WidgetDefinition } from '../../../react/widget-grid';
import type { LayoutItem } from '../../../react/widget-state';
import { LiveActivity } from '../../../react/live-activity';
import type { Activity } from '../../../react/live-activity';
import { DEFINITIONS } from '../widgets/WidgetsPage';
import { navigate, onStudioLink } from '../shell/router';
import { BookIcon, FramesIcon, GridIcon, SwatchIcon } from '../shell/icons';
import { useHydrated, usePauseMotion } from '../theme';
import { GALLERY } from '../gallery/examples';
import tokens from '../data/tokens.json';
import chapters from '../data/chapters.json';
import './front.css';

export const SECTIONS: ReadonlyArray<{ id: string; label: string }> = [];

export const INSTALL = 'npm i @verseva/design';
export const INSTALL_HREF = '/components#install';
/** How long "Copied" shows before Get started lands on the install section. */
export const COPIED_HOLD_MS = 900;
export const JOB_TICK_MS = 450;
const JOB_STEP = 0.035;
const JOB_HOLD_MS = 2400;
/* The demo job loops a few times, then rests done; Restart in its panel runs it again. */
export const JOB_CYCLES = 5;
const JOB_NAMES = ['Deploy studio', 'Import clients', 'Export ledger', 'Sync invoices', 'Agent run #419'];
const STEPS = ['Queue', 'Build', 'Upload', 'Promote'];

const jobIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>;

const newJob = (k: number, progress = 0): Activity => ({ id: `job-${k}`, name: JOB_NAMES[k % JOB_NAMES.length], steps: STEPS, progress });

/** One demo job: ticks while `live`, holds done, then the next one starts; rests after JOB_CYCLES.
    Cancel stops it (null); Restart starts a fresh run of cycles. */
function useDemoJob(live: boolean) {
  const [run, setRun] = useState({ k: 0, n: 0 });
  const [job, setJob] = useState<Activity | null>(() => newJob(0, 0.24));
  useEffect(() => {
    if (!live || !job) return;
    if (job.done) {
      if (run.n + 1 >= JOB_CYCLES) return;
      const t = setTimeout(() => { setRun({ k: run.k + 1, n: run.n + 1 }); setJob(newJob(run.k + 1)); }, JOB_HOLD_MS);
      return () => clearTimeout(t);
    }
    const t = setInterval(() => setJob((j) => {
      if (!j || j.done) return j;
      const p = Math.min(1, (j.progress ?? 0) + JOB_STEP);
      return p >= 1 ? { ...j, progress: 1, done: true } : { ...j, progress: p };
    }), JOB_TICK_MS);
    return () => clearInterval(t);
  }, [live, job?.done, job === null, run]);
  const restart = () => { setRun({ k: run.k + 1, n: 0 }); setJob(newJob(run.k + 1)); };
  const cancel = () => setJob(null);
  return { job, restart, cancel };
}

/* Until the visitor opens the capsule panel, the demo job announces nothing. */
const SILENT = { started: () => '', progress: () => '', finished: () => '', cancelled: () => '', failure: () => '' };
const SPOKEN = { clearDone: 'Restart' };
const QUIET = { ...SPOKEN, ...SILENT };

const LAYOUT: LayoutItem[] = [
  { id: 'revenue', kind: 'revenue', size: 'l' },
  { id: 'live', kind: 'live', size: 'm' },
  { id: 'job', kind: 'job', size: 'm' },
];
const PICK = new Set(['revenue', 'live']);

function LiveHome({ live }: { live: boolean }) {
  const { job, restart, cancel } = useDemoJob(live);
  const [engaged, setEngaged] = useState(false);
  const [panel, setPanel] = useState(false);
  const onOpenChange = (o: boolean) => { setPanel(o); if (o) setEngaged(true); };
  const again = <button type="button" className="btn btn-secondary sm" onClick={restart}>Restart</button>;
  /* Escape shuts the panel; with no job its capsule goes, so focus lands on the tile's Restart. */
  const tileRestart = useRef<HTMLButtonElement>(null);
  const escaped = useRef(false);
  useEffect(() => {
    if (panel || !escaped.current) return;
    escaped.current = false;
    if (!job) tileRestart.current?.focus();
  }, [panel, job]);
  const p = job?.progress ?? 0;
  const step = STEPS[Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))];
  const defs: WidgetDefinition[] = [
    ...DEFINITIONS.filter((d) => PICK.has(d.kind)),
    {
      kind: 'job', name: 'Jobs', icon: jobIcon, sizes: ['m'],
      render: () => (
        <>
          <div className="wtile-hd">{jobIcon}Jobs<span className="wtile-meta">{!job ? 'Cancelled' : job.done ? 'Done' : step}</span></div>
          <div className="jobcap" onKeyDownCapture={(e) => { if (e.key === 'Escape' && panel) escaped.current = true; }}>
            {/* With no job the panel offers the one Restart (its empty state); the tile's shows only with the panel shut. */}
            <LiveActivity activities={job ? [job] : []} onCancel={cancel} onClearDone={job ? restart : undefined} emptyAction={again} onOpenChange={onOpenChange} leaveDelay={1e9} labels={engaged ? SPOKEN : QUIET} />
            {!job && !panel && <button ref={tileRestart} type="button" className="btn btn-secondary sm" onClick={restart}>Restart</button>}
          </div>
          {job && <div className="wtile-sub">{`${Math.min(STEPS.length, Math.floor(p * STEPS.length) + 1)} of ${STEPS.length} steps`}</div>}
        </>
      ),
    },
  ];
  return (
    <WidgetGrid
      definitions={defs}
      layout={LAYOUT}
      focus="revenue"
      storageKey={null}
      longPress={0}
      labels={{ region: 'Live home' }}
    />
  );
}

/** Get started: copy the install line; say Copied only once it is copied, else point at the
    command; then land on the install section (navigate focuses it). */
function GetStarted() {
  const [said, setSaid] = useState<'' | 'Copied' | 'Command below'>('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const land = (label: 'Copied' | 'Command below') => {
    setSaid(label);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(INSTALL_HREF), COPIED_HOLD_MS);
  };
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    let copy: Promise<void> | undefined;
    try { copy = navigator.clipboard?.writeText(INSTALL); } catch { copy = undefined; }
    if (!copy) { land('Command below'); return; }
    copy.then(() => land('Copied'), () => land('Command below'));
  };
  return (
    <>
      <a className="btn btn-primary lg cta-go" href={INSTALL_HREF} onClick={onClick}>{said || 'Get started'}</a>
      <span className="sr-only" aria-live="polite">{said}</span>
    </>
  );
}

const componentCount = (chapters.find((c) => c.slug === 'components')?.sections ?? []).filter((s) => s.id !== 'install').length;
const ENTRIES: ReadonlyArray<{ href: string; label: string; n: number; sub: string; icon: () => ReactNode }> = [
  { href: '/components', label: 'Components', n: componentCount, sub: 'parts', icon: BookIcon },
  { href: '/widgets', label: 'Widgets', n: DEFINITIONS.length, sub: 'widgets', icon: GridIcon },
  { href: '/foundations', label: 'Foundations', n: tokens.length, sub: 'tokens', icon: SwatchIcon },
  { href: '/gallery', label: 'Gallery', n: GALLERY.length, sub: 'examples', icon: FramesIcon },
];

export function FrontDoorPage() {
  const hydrated = useHydrated();
  const still = usePauseMotion();
  const live = hydrated && !still;
  return (
    <div className="page front">
      <section className="hero" data-live={live ? '' : undefined}>
        <div className="aurora" aria-hidden="true"><i /><i /></div>
        <div className="hero-copy">
          <h1 className="display">One source. Every surface</h1>
          <div className="cta">
            <GetStarted />
            <a className="btn btn-secondary lg" href="/components" onClick={onStudioLink}>Browse</a>
          </div>
          <code className="cta-cmd">{INSTALL}</code>
        </div>
        <div className="hero-live">
          <LiveHome live={live} />
        </div>
      </section>
      <nav className="entry wgrid" aria-label="Sections">
        {ENTRIES.map((e) => (
          <a key={e.href} className="wtile" data-size="s" href={e.href} onClick={onStudioLink}>
            <div className="wtile-body">
              <div className="wtile-hd">{e.icon()}{e.label}</div>
              <div className="wtile-foot">
                <span className="wtile-num">{e.n}</span>
                <span className="wtile-sub">{e.sub}</span>
              </div>
            </div>
          </a>
        ))}
      </nav>
    </div>
  );
}
