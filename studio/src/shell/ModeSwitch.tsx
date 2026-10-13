// Light / Dark / System on the kit Segmented, plus roving arrow keys.
import { Segmented } from '../../../react/segmented';
import { MODES, applyTheme, useTheme, wipe, type Mode } from '../theme';

export function ModeSwitch() {
  const theme = useTheme();
  const labels = MODES.map((m) => m.label);
  const current = MODES.find((m) => m.value === theme.mode)!.label;
  const set = (label: string, e?: { clientX?: number; clientY?: number }) => {
    const mode = MODES.find((m) => m.label === label)!.value as Mode;
    wipe(e ?? null, () => applyTheme({ ...theme, mode }));
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = labels.indexOf(current);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const host = e.currentTarget;
    const next = labels[(i + step + labels.length) % labels.length];
    set(next);
    requestAnimationFrame(() => {
      const btn = [...host.querySelectorAll('button')].find((b) => b.textContent === next);
      btn?.focus();
    });
  };
  return (
    <div className="modeswitch" onKeyDown={onKeyDown}>
      <Segmented options={labels} value={current} onChange={(l) => set(l)} aria-label="Mode" />
    </div>
  );
}
