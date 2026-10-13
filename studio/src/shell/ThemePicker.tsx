// Brand preset chips (.fchip), each carrying its own accent as a swatch.
import { useEffect, useState } from 'react';
import { BRANDS, applyTheme, useTheme, wipe, type Brand } from '../theme';

function probeAccents(): Record<string, string> {
  const root = document.documentElement;
  const keep = root.dataset.brand;
  const probe = document.createElement('i');
  probe.style.display = 'none';
  probe.style.color = 'var(--accent)';
  document.body.appendChild(probe);
  const out: Record<string, string> = {};
  for (const b of BRANDS) {
    if (b.value) root.dataset.brand = b.value; else delete root.dataset.brand;
    out[b.value] = getComputedStyle(probe).color;
  }
  if (keep) root.dataset.brand = keep; else delete root.dataset.brand;
  probe.remove();
  return out;
}

export function useSwatches() {
  const theme = useTheme();
  const [sw, setSw] = useState<Record<string, string>>({});
  useEffect(() => { setSw(probeAccents()); }, [theme.mode, theme.brand]);
  return sw;
}

export function ThemePicker({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const theme = useTheme();
  const sw = useSwatches();
  const pick = (e: React.MouseEvent, brand: Brand) => wipe(e, () => applyTheme({ ...theme, brand }));
  return (
    <div className={`chiprow picker picker-${size}`} role="group" aria-label="Theme">
      {BRANDS.map((b) => (
        <button key={b.value || 'signature'} type="button" className="fchip" aria-pressed={theme.brand === b.value} onClick={(e) => pick(e, b.value)}>
          <i className="swatch" style={{ background: sw[b.value] }} aria-hidden="true" />
          {b.label}
        </button>
      ))}
    </div>
  );
}
