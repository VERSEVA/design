// The color popover's body (loaded on first open): the five presets and Custom as radios
// with arrow keys, and for Custom a hue control and a hex field, derived for both modes and
// gated live (shell/accent.ts), with Copy theme.
import { useEffect, useId, useRef, useState } from 'react';
import tokens from '../data/tokens.json';
import { BRANDS, applyTheme, resolveMode, useTheme, type Brand } from '../theme';
import { applyCustom, storedCustom } from './accent-store';
import { deriveAccent, hueBase, normalizeHex, pickAtHue, themeCss, type Derived, type HueBase, type ModeResult } from './accent';
import { trapTab } from './chunk';

type Row = { name: string; dark: string; light: string; brands: Record<string, { dark: string; light: string }> };
const ACCENT = (tokens as ReadonlyArray<Row>).find((t) => t.name === '--accent')!;
const presetAccent = (brand: Brand, mode: 'dark' | 'light') => (brand && ACCENT.brands[brand] ? ACCENT.brands[brand][mode] : ACCENT[mode]);

const OPTIONS: ReadonlyArray<{ value: Brand; label: string }> = [...BRANDS, { value: 'custom', label: 'Custom' }];

function ModeBlock({ mode, r, pick }: { mode: 'dark' | 'light'; r: ModeResult; pick: string }) {
  return (
    <section className="moderesult" data-mode-result={mode} aria-label={mode === 'dark' ? 'Dark' : 'Light'}>
      <div className="mr-hd">
        <b>{mode === 'dark' ? 'Dark' : 'Light'}</b>
        <span className="inkchip" style={{ background: r.accent, color: r.ink }} aria-hidden="true">Aa</span>
        <code className="mono">{r.accent}</code>
        {r.adjusted && <span className="badge neutral">Adjusted</span>}
        {r.adjusted && <span className="mono muted">from {pick}</span>}
      </div>
      <ul className="checks">
        {r.checks.map((c, i) => {
          const p = r.pickChecks[i];
          return (
            <li key={c.id} data-check={c.id}>
              <span className="ck-l">{c.label}</span>
              {r.adjusted && <span className={`ck-v${p.pass ? '' : ' fail'}`}>{p.ratio.toFixed(2)} {p.pass ? 'Pass' : 'Fail'}</span>}
              <span className={`ck-v${c.pass ? '' : ' fail'}`}>{c.ratio.toFixed(2)} {c.pass ? 'Pass' : 'Fail'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CustomPanel({ d, onPick }: { d: Derived; onPick: (hex: string) => void }) {
  const [text, setText] = useState(d.pick);
  const [invalid, setInvalid] = useState(false);
  const [copied, setCopied] = useState('');
  const hueId = useId();
  const hexId = useId();
  /* The hue control's base is the user's own pick (typed, preset or stored): the slider changes
     only H from it, so steps never compound through gamut-clipped output. */
  const [base, setBase] = useState<HueBase>(() => hueBase(d.pick));
  const [hue, setHue] = useState(() => hueBase(d.pick).slider);
  const fromSlider = useRef<string | null>(null);
  useEffect(() => {
    /* A pick from the hue control rewrites the field; a pick typed in the field leaves it alone. */
    setText((t) => (normalizeHex(t) === d.pick ? t : d.pick));
    setInvalid(false);
    if (fromSlider.current === d.pick) return;
    const b = hueBase(d.pick);
    setBase(b);
    setHue(b.slider);
  }, [d.pick]);
  const onHue = (v: number) => {
    setHue(v);
    const next = pickAtHue(base, v);
    fromSlider.current = next;
    if (next !== d.pick) onPick(next);
  };
  /* Six digits apply as typed; three-digit shorthand applies on Enter or blur (a half-typed value is never a pick). */
  const onHex = (v: string) => {
    setText(v);
    const full = /^#?[0-9a-fA-F]{6}$/.test(v.trim()) ? normalizeHex(v) : null;
    setInvalid(!normalizeHex(v));
    if (full && full !== d.pick) onPick(full);
  };
  const commitHex = () => {
    const hex = normalizeHex(text);
    setInvalid(!hex);
    if (hex && hex !== d.pick) onPick(hex);
  };
  const copyBtn = useRef<HTMLButtonElement>(null);
  const copy = async () => {
    const text = themeCss(d);
    try { await navigator.clipboard.writeText(text); setCopied('Copied'); return; } catch { /* blocked: fall back below */ }
    /* Clipboard API refused (embedded frames, older browsers): a selected off-screen textarea. */
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'sr-only';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    copyBtn.current?.focus();
    setCopied(ok ? 'Copied' : 'Copy failed');
  };
  return (
    <div className="custom">
      <div className="custom-in">
        <div className="field">
          <label htmlFor={hueId}>Hue</label>
          <input id={hueId} type="range" min={0} max={359} step={1} value={hue} aria-label="Hue" aria-valuetext={`${hue} degrees`} onChange={(e) => onHue(Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor={hexId}>Hex</label>
          <input id={hexId} type="text" inputMode="text" autoComplete="off" spellCheck={false} maxLength={7} value={text} aria-label="Hex" aria-invalid={invalid || undefined} onChange={(e) => onHex(e.target.value)} onBlur={commitHex} onKeyDown={(e) => { if (e.key === 'Enter') commitHex(); }} />
        </div>
      </div>
      <ModeBlock mode="dark" r={d.dark} pick={d.pick} />
      <ModeBlock mode="light" r={d.light} pick={d.pick} />
      <div className="colorpop-ft">
        <button ref={copyBtn} type="button" className="btn btn-secondary sm" onClick={copy}>Copy theme</button>
        <span className="muted" role="status" aria-live="polite">{copied}</span>
      </div>
    </div>
  );
}

export default function ColorPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const theme = useTheme();
  const [derived, setDerived] = useState<Derived | null>(() => {
    const s = theme.brand === 'custom' ? storedCustom() : null;
    return s ? deriveAccent(s.pick) : null;
  });
  const group = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);

  /* Mounted = opened: focus the checked swatch. */
  useEffect(() => { group.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus(); }, []);

  const pickCustom = (hex: string) => {
    const d = deriveAccent(hex);
    setDerived(d);
    applyCustom(d);
  };

  const choose = (b: Brand) => {
    if (b !== 'custom') { applyTheme({ ...theme, brand: b }); return; }
    const s = storedCustom();
    pickCustom(s?.pick ?? presetAccent(theme.brand === 'custom' ? '' : theme.brand, 'dark'));
  };

  const onRadioKey = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? OPTIONS.length - 1 : step ? (i + step + OPTIONS.length) % OPTIONS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    choose(OPTIONS[to].value);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[to]?.focus();
  };

  const mode = resolveMode(theme.mode);
  const swatch = (b: Brand) => {
    if (b !== 'custom') return presetAccent(b, mode);
    const s = storedCustom();
    return s ? s[mode].accent : undefined;
  };
  const d = theme.brand === 'custom' ? derived : null;

  return (
    <div id={id} ref={box} className="menu-list panel colorpop" role="dialog" aria-modal="true" aria-label="Color"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; } trapTab(e, box.current); }}>
      <div className="grab" aria-hidden="true" />
      <div className="swatches" role="radiogroup" aria-label="Accent" ref={group}>
        {OPTIONS.map((o, i) => {
          const on = theme.brand === o.value;
          const bg = swatch(o.value);
          return (
            <button
              key={o.value || 'signature'}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              className="swatchbtn"
              onClick={() => choose(o.value)}
              onKeyDown={(e) => onRadioKey(e, i)}
            >
              <i className={`swatch${bg ? '' : ' swatch-none'}`} style={bg ? { background: bg } : undefined} aria-hidden="true" />
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
      {d && <CustomPanel d={d} onPick={pickCustom} />}
    </div>
  );
}
