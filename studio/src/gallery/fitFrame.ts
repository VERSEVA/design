// An example frame as tall as its document, so the studio page is the one scrollbar.
// Viewport-height rules in the frame are pinned to px first (at the studio viewport
// height, what they had when the example ran on its own); otherwise a 100vh stage
// would grow with the frame on every pass.
const VH = /(-?\d*\.?\d+)[dsl]?vh\b/g;
const PROPS = ['height', 'min-height', 'max-height'];

export function pinViewportUnits(d: Document, base: number) {
  if (d.querySelector('style[data-vsv-vh]')) return;
  const px = (v: string) => v.replace(VH, (_, n: string) => `${((Number(n) * base) / 100).toFixed(2)}px`);
  const walk = (rules: CSSRuleList): string[] => [...rules].flatMap((r) => {
    const style = (r as CSSStyleRule).style;
    if ((r as CSSStyleRule).selectorText !== undefined && style) {
      const decls = PROPS.flatMap((p) => { const v = style.getPropertyValue(p); return /vh\b/.test(v) ? [`${p}: ${px(v)}`] : []; });
      return decls.length ? [`${(r as CSSStyleRule).selectorText} { ${decls.join('; ')}; }`] : [];
    }
    const inner = (r as CSSGroupingRule).cssRules;
    if (!inner) return [];
    const head = r.type === 4 ? `@media ${(r as CSSMediaRule).media.mediaText}` : r.type === 12 ? `@supports ${(r as CSSSupportsRule).conditionText}` : null;
    const body = walk(inner);
    return head && body.length ? [`${head} { ${body.join(' ')} }`] : [];
  });
  const out = [...d.styleSheets].flatMap((s) => { try { return walk(s.cssRules); } catch { return []; } });
  const st = d.createElement('style');
  st.dataset.vsvVh = '';
  st.textContent = out.join('\n');
  (d.head ?? d.documentElement).appendChild(st);
}

/** Fits the frame to its document from load on; returns the cleanup. */
export function fitToDocument(f: HTMLIFrameElement): () => void {
  let ro: ResizeObserver | null = null;
  let passes = 0;
  const fit = () => {
    const d = f.contentDocument;
    if (!d?.documentElement) return;
    if (++passes > 60) { ro?.disconnect(); return; }
    f.style.height = `${d.documentElement.scrollHeight}px`;
  };
  const onLoad = () => {
    const d = f.contentDocument;
    if (!d?.documentElement) return;
    passes = 0;
    pinViewportUnits(d, window.innerHeight);
    ro?.disconnect();
    ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(d.body ?? d.documentElement);
    fit();
  };
  f.setAttribute('scrolling', 'no');
  f.addEventListener('load', onLoad);
  if (f.contentDocument?.readyState === 'complete' && f.contentDocument.body?.childElementCount) onLoad();
  return () => { f.removeEventListener('load', onLoad); ro?.disconnect(); };
}
