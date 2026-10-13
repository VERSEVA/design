import { EMBLEM } from './emblem';
import { ModeSwitch } from './ModeSwitch';
import { ThemePicker } from './ThemePicker';
import { onStudioLink } from './router';
import { setMotionPaused, usePauseMotion } from '../theme';
import pkg from '../../../package.json';

const GH = 'M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z';

export function StudioHeader({ showPicker }: { showPicker: boolean }) {
  const paused = usePauseMotion();
  return (
    <header className="studio-head">
      <a href="/" className="lockup" onClick={onStudioLink} aria-label="VERSEVA Design home">
        <span className="mark" dangerouslySetInnerHTML={{ __html: EMBLEM }} />
        <b>VERSEVA</b><span className="sub">Design</span>
        <span className="badge neutral">{pkg.version}</span>
      </a>
      <span className="grow" />
      {showPicker && <ThemePicker />}
      <ModeSwitch />
      <button type="button" className="btn btn-ghost icon" aria-pressed={paused} aria-label="Pause motion" onClick={() => setMotionPaused(!paused)}>
        {paused
          ? <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l10.5-6.5z" /></svg>
          : <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>}
      </button>
      <a className="btn btn-ghost icon" href="https://github.com/verseva/design" aria-label="GitHub">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d={GH} /></svg>
      </a>
      <a className="btn btn-ghost icon" href="https://www.npmjs.com/package/@verseva/design" aria-label="npm">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 7h18v9h-9v2H8v-2H3zm2 2v5h2v-3h2v3h2V9zm8 0v5h2v-1h2V9zm2 2h0v1h0z" /></svg>
      </a>
    </header>
  );
}
