// The top bar: the package's three-column .tbar (a .searchbox in the middle turns it on).
// Left: lockup and version. Centre: the command bar trigger (an icon button under 900px).
// Right: color, mode, pause motion, GitHub.
import { useEffect, useRef, useState } from 'react';
import type { Command } from '../../../react/command-bar';
import { LazyCommandBar, SearchTrigger, loadCommandBar } from './LazyCommandBar';
import { chunk } from './chunk';
import { isSearchShortcut } from '../../../react/console-state';
import { EMBLEM } from './emblem';
import { ModeButton } from './ModeButton';
import { ColorPopover } from './ColorPopover';
import { SearchIcon } from './icons';
import { onStudioLink } from './router';
import { setMotionPaused, usePauseMotion } from '../theme';
import { version } from '../../../package.json';

export const searchChunk = chunk(() => import('./search'));

const GH = 'M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z';

const BAR_LABELS = { dialog: 'Search', input: 'Search pages and sections', placeholder: 'Search pages and sections', results: 'Results' };

export function StudioHeader() {
  const paused = usePauseMotion();
  const [searchOpen, setSearchOpen] = useState(false);
  /* The commands (every route and section) are their own chunk, fetched on first intent:
     a pointer or focus in the top bar, the chord, opening the bar, or idle. A failure resets,
     so the next intent or Retry fetches again, and the open bar shows the error state. */
  const [commands, setCommands] = useState<Command[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const want = () => {
    if (busy.current) return;
    busy.current = true;
    void loadCommandBar();
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    searchChunk.get().then(
      (m) => { if (mounted.current) { setCommands(m.studioCommands()); setStatus('ready'); } },
      () => { busy.current = false; if (mounted.current) setStatus('failed'); },
    );
  };
  const retryCommands = () => { searchChunk.reset(); busy.current = false; want(); };
  const open = () => { want(); setSearchOpen(true); };
  /* Intent in the bar itself (its overlay lives in the header) is not a new request: Retry is. */
  const intent = (e: React.SyntheticEvent) => { if (!(e.target as Element).closest?.('.cmdk-ovl')) want(); };
  /* And once the browser is idle, so a cold chord finds them loaded (no requestIdleCallback: intent only). */
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (!w.requestIdleCallback) return;
    const id = w.requestIdleCallback(() => want(), { timeout: 3000 });
    return () => w.cancelIdleCallback?.(id);
  }, []);
  /* ⌘K / Ctrl K, studio-wide. The bar's own shortcut stands down while any aria-modal is
     open, and chapter pages show open dialog specimens, so the studio owns the chord. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e)) return;
      e.preventDefault();
      want();
      setSearchOpen((v) => !v);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <header className="tbar studio-head" onPointerOver={intent} onFocusCapture={intent}>
      <div className="tbar-start">
        <a href="/" className="lockup" onClick={onStudioLink} aria-label="VERSEVA Design home">
          <span className="mark" dangerouslySetInnerHTML={{ __html: EMBLEM }} />
          <b>VERSEVA</b><span className="sub">Design</span>
          <span className="badge neutral">{version}</span>
        </a>
      </div>
      <SearchTrigger onOpen={open} label="Search" />
      <div className="tbar-end">
        <button type="button" className="ibtn searchbtn" aria-label="Search" aria-haspopup="dialog" onClick={(e) => { e.currentTarget.focus(); open(); }}>
          <SearchIcon />
        </button>
        <ColorPopover />
        <ModeButton />
        <button type="button" className="ibtn" aria-pressed={paused} aria-label="Pause motion" onClick={() => setMotionPaused(!paused)}>
          {paused
            ? <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l10.5-6.5z" /></svg>
            : <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>}
        </button>
        <a className="ibtn" href="https://github.com/verseva/design" aria-label="GitHub">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d={GH} /></svg>
        </a>
      </div>
      <LazyCommandBar commandsFailed={status === 'failed'} onRetryCommands={retryCommands} commands={commands} open={searchOpen} onOpenChange={setSearchOpen} shortcut={false} labels={BAR_LABELS} />
    </header>
  );
}
