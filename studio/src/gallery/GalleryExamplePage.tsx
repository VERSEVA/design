// One gallery example inside the studio shell: the example file in a frame, with
// its breadcrumb and a link to its source. Links clicked inside the frame route
// through the studio, so the shell never gives way to the example's own page.
import { useEffect, useRef } from 'react';
import { navigate, onStudioLink } from '../shell/router';
import { exampleLink, GALLERY } from './examples';
import './gallery.css';

export function GalleryExamplePage({ slug }: { slug: string }) {
  const label = GALLERY.find((g) => g.slug === slug)?.label ?? slug;
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    let doc: Document | null = null;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href) return;
      const here = f.contentWindow?.location.href;
      const base = here && here !== 'about:blank' ? here : new URL(f.getAttribute('src')!, window.location.origin).href;
      const to = exampleLink(href, base, window.location.origin);
      if (to) { e.preventDefault(); navigate(to); }
    };
    const attach = () => {
      doc?.removeEventListener('click', onClick);
      try { doc = f.contentDocument; } catch { doc = null; }
      doc?.addEventListener('click', onClick);
    };
    f.addEventListener('load', attach);
    attach();
    return () => { f.removeEventListener('load', attach); doc?.removeEventListener('click', onClick); };
  }, [slug]);

  return (
    <section className="page gex" data-gallery={slug}>
      <nav className="crumbs pb-3" aria-label="Breadcrumb">
        <a href="/gallery" onClick={onStudioLink}>Gallery</a>
        <span className="sep" aria-hidden="true">/</span>
        <span aria-current="page">{label}</span>
      </nav>
      <div className="gex-head">
        <h1>{label}</h1>
        <a className="btn btn-secondary sm" href={`/gallery/${slug}/code`} onClick={onStudioLink}>Code</a>
      </div>
      <iframe ref={frame} className="gex-frame" src={`/examples/${slug}.html`} title={label} />
    </section>
  );
}
