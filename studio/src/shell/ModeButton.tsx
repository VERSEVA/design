// Mode: one icon button cycling light, dark, system. The icon is drawn from <html data-mode>
// (studio.css), which the head script sets before first paint, so the server's placeholder
// never shows a wrong icon. The label settles on hydration; each change is announced.
import { useState } from 'react';
import { NEXT_MODE, applyTheme, useHydrated, useTheme } from '../theme';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

export function ModeButton() {
  const theme = useTheme();
  const hydrated = useHydrated();
  const [said, setSaid] = useState('');
  const next = NEXT_MODE[theme.mode];
  const cycle = () => {
    applyTheme({ ...theme, mode: next });
    setSaid(`Theme: ${next}`);
  };
  return (
    <>
      <button type="button" className="ibtn modebtn" data-pending={hydrated ? undefined : ''} aria-label={`Theme: ${theme.mode}. Switch to ${next}`} onClick={cycle}>
        <SunIcon className="mi mi-light" />
        <MoonIcon className="mi mi-dark" />
        <MonitorIcon className="mi mi-system" />
      </button>
      <span className="sr-only" role="status" aria-live="polite">{said}</span>
    </>
  );
}
