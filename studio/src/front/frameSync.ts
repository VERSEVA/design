// Keeps same-origin example frames on the studio theme: brand + mode attributes
// on each frame document, plus the four preset sheets injected once per frame.
import { getTheme, setAttrs, type ThemeState } from '../theme';

export const FRAME_THEMES = ['cobalt', 'forest', 'slate', 'violet'] as const;

function injectThemes(d: Document) {
  const head = d.head ?? d.documentElement;
  for (const t of FRAME_THEMES) {
    if (d.querySelector(`link[data-vsv-theme="${t}"]`)) continue;
    const l = d.createElement('link');
    l.rel = 'stylesheet';
    l.href = `/themes/${t}.css`;
    l.dataset.vsvTheme = t;
    head.appendChild(l);
  }
}

export function syncFrame(f: HTMLIFrameElement, state: ThemeState = getTheme()) {
  try {
    const d = f.contentDocument;
    if (!d?.documentElement) return;
    injectThemes(d);
    setAttrs(d.documentElement, state);
  } catch { /* cross-origin frame: leave it alone */ }
}

/* Scale a fixed-size frame to its wrapper width. */
export function fitFrame(f: HTMLIFrameElement) {
  const w = f.parentElement?.clientWidth ?? 0;
  if (w && f.offsetWidth) f.style.transform = `scale(${w / f.offsetWidth})`;
}

export function watchFrames(root: ParentNode): () => void {
  const frames = [...root.querySelectorAll('iframe')];
  const onLoad = (e: Event) => { const f = e.currentTarget as HTMLIFrameElement; syncFrame(f); fitFrame(f); };
  const onTheme = () => frames.forEach((f) => syncFrame(f));
  const fitAll = () => frames.forEach(fitFrame);
  frames.forEach((f) => { f.addEventListener('load', onLoad); syncFrame(f); fitFrame(f); });
  window.addEventListener('vsv-theme', onTheme);
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitAll);
  frames.forEach((f) => f.parentElement && ro?.observe(f.parentElement));
  return () => {
    frames.forEach((f) => f.removeEventListener('load', onLoad));
    window.removeEventListener('vsv-theme', onTheme);
    ro?.disconnect();
  };
}
