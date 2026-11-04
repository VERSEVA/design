// /widgets: live specimens of the 1.6 parts on the package code. Labels and data only.
import * as React from 'react';
import { WidgetGrid } from '../../../react/widget-grid';
import type { WidgetDefinition, WidgetStatus } from '../../../react/widget-grid';
import { SmartStack } from '../../../react/smart-stack';
import { LiveActivity } from '../../../react/live-activity';
import type { Activity } from '../../../react/live-activity';
import { CommandBar, CommandBarTrigger } from '../../../react/command-bar';
import type { AskResult, Command } from '../../../react/command-bar';
import { ConsoleTopbar } from '../../../react/console-topbar';
import type { NotificationItem } from '../../../react/console-topbar';
import { ActivityStrip, Bars, HBars, LineChart, Ring, Sparkline, Trend } from '../../../react/viz';
import { addWidget, move } from '../../../react/widget-state';
import type { LayoutItem, WidgetSize } from '../../../react/widget-state';
import { navigate } from '../shell/router';
import { usePauseMotion } from '../theme';
import './widgets.css';

export const SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'sizes', label: 'Sizes' },
  { id: 'states', label: 'States' },
];

/* ---------- icons ---------- */
const icon = (d: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const I = {
  revenue: icon(<><path d="M4 19h16" /><path d="M7 15l4-4 3 3 5-6" /></>),
  runway: icon(<><path d="M7 3h10M7 21h10" /><path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9" /></>),
  tasks: icon(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  live: icon(<path d="M3 12h4l3-7 4 14 3-7h4" />),
  week: icon(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>),
  pipeline: icon(<path d="M4 5h16l-6 7v6l-4 2v-8z" />),
  edit: icon(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>),
  play: icon(<path d="M8 5.5v13l10-6.5z" />),
  alert: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>),
  reset: icon(<><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4h4" /></>),
  go: icon(<path d="M9 6l6 6-6 6" />),
};

/* ---------- data ---------- */
const REV = [41, 44, 43, 52, 49, 58, 61, 57, 66, 70, 68, 78];
const REV_PREV = [38, 40, 42, 41, 45, 47, 50, 49, 53, 55, 57, 60];
const WEEKS = REV.map((_, i) => `W${i + 1}`);
const CLIENTS: [string, string, string, 'good' | 'bad'][] = [
  ['Harbor Botanics', '₱820k', '+18%', 'good'],
  ['Kestrel Co', '₱610k', '+9%', 'good'],
  ['Orbit Studio', '₱410k', '−3%', 'bad'],
  ['Meridian Goods', '₱180k', '+22%', 'good'],
  ['Crestpoint Labs', '₱92k', '+4%', 'good'],
];
const TASKS: [string, string][] = [['Approve Q-2081 quote', 'Today'], ['Send Kestrel invoice', 'Overdue'], ['Review agent run #418', 'Today'], ['Sign Orbit SOW', 'Fri'], ['Close October books', 'Overdue'], ['Renew domain', 'Nov 12']];

const Hd = ({ i, label, meta }: { i: React.ReactNode; label: string; meta?: string }) => (
  <div className="wtile-hd">{i}{label}{meta && <span className="wtile-meta">{meta}</span>}</div>
);
const Rows = ({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) => (
  <div className="wtile-rows">{rows.map(([a, b], k) => <div className="wtile-row" key={k}>{a}<span className="wtile-val">{b}</span></div>)}</div>
);

function revenueView(size: WidgetSize) {
  const head = <><div className="wtile-num">₱1.84M</div><div className="wtile-sub"><Trend delta="+12.4%" judgment="good" /> vs Oct</div></>;
  if (size === 's') return <><Hd i={I.revenue} label="Revenue" />{head}</>;
  if (size === 'm') return <><Hd i={I.revenue} label="Revenue" meta="Nov" /><div className="wx-split"><div>{head}</div><Sparkline values={REV} /></div></>;
  if (size === 'l') {
    return (
      <>
        <Hd i={I.revenue} label="Revenue" meta="Nov" />
        {head}
        <Bars data={REV.slice(-6).map((value, k) => ({ label: WEEKS[k + 6], value }))} showValues={false} height={96} />
        <Rows rows={CLIENTS.slice(0, 3).map(([n, v]) => [<b key="n">{n}</b>, v])} />
      </>
    );
  }
  return (
    <>
      <Hd i={I.revenue} label="Revenue by client" meta="Last 12 weeks" />
      <div className="wx-xl">
        <div className="wx-col">{head}<LineChart labels={WEEKS} series={[{ name: 'This year', values: REV }, { name: 'Last year', values: REV_PREV }]} height={150} /></div>
        <Rows rows={CLIENTS.map(([n, v, d, j]) => [<b key="n">{n}</b>, <>{v} <Trend delta={d} judgment={j} /></>])} />
      </div>
    </>
  );
}

const LIVE_PAGES = (size: WidgetSize) => [
  { label: 'Agents', content: size === 's'
    ? <><Hd i={I.live} label="Agents" /><div className="wtile-num">3</div><div className="wtile-sub">running</div></>
    : <><Hd i={I.live} label="Agents running" meta="3" /><Rows rows={[[<b key="a">Invoice reconcile</b>, 'Step 3/5'], [<b key="b">Lead triage</b>, '41 left'], [<b key="c">Weekly digest</b>, 'Drafting']]} /></> },
  { label: 'Deploys', content: size === 's'
    ? <><Hd i={I.live} label="Deploys" /><div className="wtile-num">1</div><div className="wtile-sub">building</div></>
    : <><Hd i={I.live} label="Deploys" meta="Today 4" /><Rows rows={[[<b key="a">studio</b>, 'Building'], [<b key="b">site</b>, '12m ago'], [<b key="c">api</b>, '1h ago']]} /></> },
  { label: 'Approvals', content: size === 's'
    ? <><Hd i={I.live} label="Approvals" /><div className="wtile-num">4</div><div className="wtile-sub">waiting</div></>
    : <><Hd i={I.live} label="Approvals" meta="4" /><Rows rows={[[<b key="a">Q-2081</b>, '₱240k'], [<b key="b">PO-77</b>, '₱88k'], [<b key="c">SOW-12</b>, '₱410k']]} /></> },
];

/* The stack rotates on its own, so the studio's Pause motion stops it too (WCAG 2.2.2). */
function LiveStack({ size, editing }: { size: WidgetSize; editing: boolean }) {
  const still = usePauseMotion();
  return <SmartStack label="Live now" pages={LIVE_PAGES(size)} paused={editing || still} />;
}

export const DEFINITIONS: WidgetDefinition[] = [
  { kind: 'revenue', name: 'Revenue', icon: I.revenue, sizes: ['s', 'm', 'l', 'xl'], render: revenueView },
  {
    kind: 'live', name: 'Live now', icon: I.live, sizes: ['s', 'm'],
    render: (size, st) => <LiveStack size={size} editing={st.editing} />,
  },
  {
    kind: 'runway', name: 'Runway', icon: I.runway, sizes: ['s', 'm'],
    render: (size) => size === 's'
      ? <><Hd i={I.runway} label="Runway" /><Ring value={62} center="9.2" sub="months" size={66} /></>
      : <><Hd i={I.runway} label="Runway" meta="Burn ₱410k/mo" /><div className="wx-split"><Ring value={62} center="9.2" sub="months" size={66} /><Bars data={[['Jun', 380], ['Jul', 420], ['Aug', 395], ['Sep', 450], ['Oct', 430], ['Nov', 410]].map(([label, value]) => ({ label: String(label), value: Number(value) }))} showValues={false} height={64} /></div></>,
  },
  {
    kind: 'tasks', name: 'Tasks', icon: I.tasks, sizes: ['s', 'm', 'l'],
    render: (size) => size === 's'
      ? <><Hd i={I.tasks} label="Due" /><div className="wtile-num">7</div><div className="wtile-sub">2 overdue</div></>
      : <><Hd i={I.tasks} label="Due" meta="7" /><Rows rows={TASKS.slice(0, size === 'm' ? 3 : 6).map(([t, d]) => [<b key="t">{t}</b>, d])} /></>,
  },
  {
    kind: 'week', name: 'This week', icon: I.week, sizes: ['m', 'l'],
    render: (size) => (
      <>
        <Hd i={I.week} label="This week" meta="Nov 2 to 8" />
        <ActivityStrip levels={[1, 0, 3, 2, 1, 0, 0]} todayIndex={2} labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']} />
        {size === 'l' && <Rows rows={[[<b key="a">10:00</b>, 'Harbor review'], [<b key="b">14:30</b>, 'Kestrel kickoff'], [<b key="c">17:00</b>, 'Payroll cutoff']]} />}
      </>
    ),
  },
  {
    kind: 'pipeline', name: 'Pipeline', icon: I.pipeline, sizes: ['s', 'm', 'l'],
    render: (size) => size === 's'
      ? <><Hd i={I.pipeline} label="Pipeline" /><div className="wtile-num">₱3.1M</div><div className="wtile-sub">14 open deals</div></>
      : <><Hd i={I.pipeline} label="Pipeline" meta="14 deals" />{size === 'l' && <div className="wtile-num">₱3.1M</div>}<HBars data={[['Lead', 48], ['Qualified', 26], ['Proposal', 14], ['Negotiate', 7], ['Won', 4]].slice(0, size === 'm' ? 3 : 5).map(([label, value]) => ({ label: String(label), value: Number(value), alt: label === 'Won' }))} /></>,
  },
];

const HOME: LayoutItem[] = [
  { id: 'live', kind: 'live', size: 'm' },
  { id: 'revenue', kind: 'revenue', size: 'l' },
  { id: 'tasks', kind: 'tasks', size: 's' },
  { id: 'runway', kind: 'runway', size: 's' },
  { id: 'week', kind: 'week', size: 'm' },
  { id: 'pipeline', kind: 'pipeline', size: 'm' },
];
const FOCUS = 'revenue';
const SIZES: LayoutItem[] = (['s', 'm', 'l', 'xl'] as const).map((size) => ({ id: `rev-${size}`, kind: 'revenue', size }));

/* ---------- live activity demo ---------- */
const JOB_NAMES = ['Deploy studio', 'Import clients', 'Agent run #419', 'Export ledger', 'Sync invoices'];
const STEPS = ['Queue', 'Build', 'Upload', 'Promote'];

function useJobs(onDone: (a: Activity) => void) {
  const [jobs, setJobs] = React.useState<Activity[]>([]);
  const n = React.useRef(0);
  const running = jobs.some((j) => !j.done && !j.error);
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setJobs((list) => list.map((j) => {
        if (j.done || j.error) return j;
        const p = Math.min(1, (j.progress ?? 0) + 0.016 + ((n.current + j.id.length) % 3) * 0.006);
        return p >= 1 ? { ...j, progress: 1, done: true } : { ...j, progress: p };
      }));
    }, 450);
    return () => clearInterval(t);
  }, [running]);
  const start = () => {
    const k = n.current++;
    setJobs((list) => [...list, { id: `job-${k}`, name: JOB_NAMES[k % JOB_NAMES.length], steps: STEPS, progress: 0 }]);
  };
  const fail = () => setJobs((list) => {
    const live = list.filter((j) => !j.done && !j.error);
    const lead = live.reduce<Activity | null>((b, j) => (!b || (j.progress ?? 0) > (b.progress ?? 0) ? j : b), null);
    return lead ? list.map((j) => (j.id === lead.id ? { ...j, error: 'Build failed' } : j)) : list;
  });
  const props = {
    activities: jobs,
    onCancel: (id: string) => setJobs((l) => l.filter((j) => j.id !== id)),
    onRetry: (id: string) => setJobs((l) => l.map((j) => (j.id === id ? { ...j, error: undefined, progress: 0 } : j))),
    onLeave: (id: string) => setJobs((l) => l.filter((j) => j.id !== id)),
    onClearDone: () => setJobs((l) => l.filter((j) => !j.done || j.error)),
    onDone,
  };
  return { props, start, fail, anyRunning: running };
}

/* ---------- ask demo ---------- */
const ANSWER = 'Revenue this month is ₱1.84M, up 12.4% on October. Harbor Botanics leads at ₱820k.';
/** Resolves after ms; rejects on abort. The abort listener goes when either happens. */
export const wait = (ms: number, signal: AbortSignal) => new Promise<void>((res, rej) => {
  const onAbort = () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); };
  const t = setTimeout(() => { signal.removeEventListener('abort', onAbort); res(); }, ms);
  signal.addEventListener('abort', onAbort, { once: true });
});
const Preview = () => (
  <div className="wtile glass" data-size="m"><div className="wtile-body">{revenueView('m')}</div></div>
);
function streamAnswer(_q: string, { signal }: { signal: AbortSignal }): AskResult {
  async function* chunks() {
    await wait(700, signal);
    for (const word of ANSWER.split(/(?<= )/)) { await wait(60, signal); yield word; }
  }
  return Object.assign(chunks(), { widget: <Preview /> });
}
const neverAnswer = (_q: string, { signal }: { signal: AbortSignal }) => new Promise<AskResult>((_, rej) => signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')), { once: true }));
const failAnswer = async (_q: string, { signal }: { signal: AbortSignal }): Promise<AskResult> => { await wait(600, signal); throw new Error('Ask failed'); };

/* ---------- page ---------- */
/* The console's phone nav (.navshell): the sidebar hides below 900px, so this is the nav there. */
const NAV = [
  { label: 'Home', icon: icon(<><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></>) },
  { label: 'Quotes', icon: icon(<rect x="5" y="5" width="14" height="14" rx="3" />) },
  { label: 'Trends', icon: icon(<path d="M4 18 10 10l4 4 6-8" />) },
  { label: 'You', icon: icon(<><circle cx="12" cy="9" r="4" /><path d="M5 20c2-5 12-5 14 0" /></>) },
] as const;

function SpecimenNav() {
  const [on, setOn] = React.useState<string>('Home');
  return (
    <nav className="navshell" aria-label="Console">
      <div className="navmain">
        {NAV.map((t) => (
          <button key={t.label} type="button" className={t.label === on ? 'tab on' : 'tab'} aria-current={t.label === on ? 'page' : undefined} onClick={() => setOn(t.label)}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

const NOTES: NotificationItem[] = [
  { id: 'n-1', text: <><b>Q-2081</b> approved</>, at: '2 min ago', unread: false },
  { id: 'n-2', text: <><b>Kestrel Co</b> paid INV-311</>, at: '1 hour ago', unread: false },
];

function HomeSpecimen() {
  const [layout, setLayout] = React.useState<LayoutItem[]>(HOME);
  const [editing, setEditing] = React.useState(false);
  const [barOpen, setBarOpen] = React.useState(false);
  const [notes, setNotes] = React.useState<NotificationItem[]>(NOTES);
  const editRef = React.useRef<HTMLButtonElement>(null);
  const jobs = useJobs((a) => setNotes((l) => [{ id: `n-${a.id}`, text: <><b>{a.name}</b> done</>, at: 'Just now', unread: true }, ...l]));

  const commands: Command[] = [
    { group: 'Actions', label: 'Edit Home', icon: I.edit, keywords: ['widgets', 'rearrange'], run: () => setEditing(true) },
    { group: 'Actions', label: 'Start job', icon: I.play, keywords: ['deploy', 'activity'], run: jobs.start },
    { group: 'Actions', label: 'Reset Home', icon: I.reset, run: () => setLayout(HOME) },
    { group: 'Go to', label: 'Overview', icon: I.go, run: () => navigate('/') },
    { group: 'Go to', label: 'Foundations', icon: I.go, run: () => navigate('/foundations') },
    { group: 'Go to', label: 'Gallery', icon: I.go, run: () => navigate('/gallery') },
  ];

  const pin = () => setLayout((l) => move(addWidget(l, 'revenue', 'm'), l.length, 0));

  return (
    <>
      <div className="wx-controls" role="toolbar" aria-label="Demo">
        <button type="button" className="btn btn-secondary sm" onClick={jobs.start}>{I.play}Start job</button>
        <button type="button" className="btn btn-secondary sm" onClick={jobs.fail} disabled={!jobs.anyRunning}>{I.alert}Fail job</button>
        <button type="button" className="btn btn-secondary sm" onClick={() => setLayout(HOME)}>{I.reset}Reset</button>
      </div>
      <div className="wx-console glass">
        <ConsoleTopbar
          crumbs={[{ label: 'Operate' }, { label: 'Home' }]}
          search={<CommandBarTrigger onOpen={() => setBarOpen(true)} />}
          end={<LiveActivity {...jobs.props} />}
          notifications={notes}
          onMarkAllRead={() => setNotes((l) => l.map((x) => ({ ...x, unread: false })))}
        />
        <div className="wx-body">
          <div className="wx-head">
            <b>Home</b>
            <button type="button" ref={editRef} className="btn btn-secondary sm" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
              {I.edit}<span>{editing ? 'Done' : 'Edit'}</span>
            </button>
          </div>
          <WidgetGrid
            definitions={DEFINITIONS}
            layout={layout}
            onLayoutChange={setLayout}
            editing={editing}
            onEditingChange={setEditing}
            toggleRef={editRef}
            focus={FOCUS}
            storageKey={null}
            labels={{ region: 'Home widgets' }}
          />
        </div>
        <SpecimenNav />
      </div>
      <CommandBar commands={commands} onAsk={streamAnswer} onPin={pin} open={barOpen} onOpenChange={setBarOpen} />
    </>
  );
}

function SizesSpecimen() {
  return <WidgetGrid definitions={DEFINITIONS} defaultLayout={SIZES} storageKey={null} longPress={0} labels={{ region: 'Revenue sizes' }} />;
}

function WidgetStates() {
  const [status, setStatus] = React.useState<Record<string, WidgetStatus>>({ 'st-load': { loading: true }, 'st-err': { error: 'Revenue did not load.' } });
  const [empty, setEmpty] = React.useState<LayoutItem[]>([]);
  const timers = React.useRef(new Set<ReturnType<typeof setTimeout>>());
  React.useEffect(() => { const t = timers.current; return () => { t.forEach((x) => clearTimeout(x)); t.clear(); }; }, []);
  const retry = (id: string) => {
    setStatus((s) => ({ ...s, [id]: { loading: true } }));
    const t = setTimeout(() => { timers.current.delete(t); setStatus((s) => ({ ...s, [id]: { error: 'Revenue did not load.' } })); }, 1200);
    timers.current.add(t);
  };
  return (
    <div className="wx-states">
      <div className="wx-state">
        <span className="wx-label">Loading and error</span>
        <WidgetGrid
          definitions={DEFINITIONS}
          defaultLayout={[{ id: 'st-load', kind: 'revenue', size: 'm' }, { id: 'st-err', kind: 'revenue', size: 'm' }]}
          status={status}
          onRetry={retry}
          storageKey={null}
          longPress={0}
          labels={{ region: 'Loading and error widgets' }}
        />
      </div>
      <div className="wx-state">
        <span className="wx-label">Empty</span>
        <WidgetGrid definitions={DEFINITIONS} layout={empty} onLayoutChange={setEmpty} storageKey={null} longPress={0} labels={{ region: 'Empty widgets' }} />
      </div>
    </div>
  );
}

function ActivityStates() {
  const rows: { label: string; jobs: Activity[] }[] = [
    { label: 'Starting', jobs: [{ id: 'p', name: 'Import clients', steps: STEPS, progress: null }] },
    { label: 'Running', jobs: [{ id: 'r', name: 'Deploy studio', steps: STEPS, progress: 0.62 }, { id: 'r2', name: 'Export ledger', steps: STEPS, progress: 0.2 }] },
    { label: 'Done', jobs: [{ id: 'd', name: 'Sync invoices', steps: STEPS, progress: 1, done: true }] },
    { label: 'Failed', jobs: [{ id: 'e', name: 'Agent run #418', steps: STEPS, progress: 0.4, error: 'Build failed' }] },
    { label: 'Empty', jobs: [] },
  ];
  return (
    <div className="wx-bars">
      {rows.map((r) => (
        <ConsoleTopbar key={r.label} className="wx-tbar" crumbs={[{ label: r.label }]} labels={{ breadcrumb: r.label }} end={<LiveActivity activities={r.jobs} onRetry={() => {}} onCancel={() => {}} leaveDelay={1e9} />} notifications={[]} />
      ))}
    </div>
  );
}

const STATE_COMMANDS: Command[] = [
  { group: 'Actions', label: 'New invoice', hint: 'N I', run: () => {} },
  { group: 'Go to', label: 'Invoices', run: () => {} },
];

function CommandStates() {
  const [open, setOpen] = React.useState<'none' | 'loading' | 'error' | null>(null);
  const bar = (k: 'none' | 'loading' | 'error', onAsk?: (q: string, c: { signal: AbortSignal }) => AskResult | Promise<AskResult>) => (
    <CommandBar commands={STATE_COMMANDS} onAsk={onAsk} shortcut={false} open={open === k} onOpenChange={(v) => setOpen(v ? k : null)} />
  );
  return (
    <>
      <div className="wx-controls" role="group" aria-label="Command bar states">
        <button type="button" className="btn btn-secondary sm" aria-haspopup="dialog" onClick={() => setOpen('none')}>No results</button>
        <button type="button" className="btn btn-secondary sm" aria-haspopup="dialog" onClick={() => setOpen('loading')}>Loading</button>
        <button type="button" className="btn btn-secondary sm" aria-haspopup="dialog" onClick={() => setOpen('error')}>Error</button>
      </div>
      {bar('none')}
      {bar('loading', neverAnswer)}
      {bar('error', failAnswer)}
    </>
  );
}

export function WidgetsPage() {
  return (
    <div className="page">
      <h1 className="display">Widgets</h1>
      <section className="section" id="home">
        <h2>Home</h2>
        <HomeSpecimen />
      </section>
      <section className="section" id="sizes">
        <h2>Sizes <span className="cnt">S M L XL</span></h2>
        <SizesSpecimen />
      </section>
      <section className="section" id="states">
        <h2>States</h2>
        <h3 className="wx-sub">Widgets</h3>
        <WidgetStates />
        <h3 className="wx-sub">Live activity</h3>
        <ActivityStates />
        <h3 className="wx-sub">Command bar</h3>
        <CommandStates />
      </section>
    </div>
  );
}
