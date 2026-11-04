// A gallery example's source inside the studio shell, ported from site/code.html
// (frozen): the same head, source box, buttons and footer that page showed once its
// script had read ?f=. The slug comes from the route; the source is the served file
// /examples/<slug>.html, bundled as its own chunk (sources.ts), so the pre-rendered page
// holds the real text and the main bundle carries none of it.
import { useEffect, useRef, useState } from 'react';
import { NativeChapter } from '../chapters/NativeChapter';
import { onStudioLink } from '../shell/router';
import { GALLERY } from './examples';
import { useSource } from './sources';
import './code.css';

/* sha256 of site/code.html; the parity test fails if the frozen page changes. */
export const FROZEN_CODE = '488c27a0dd7cd4bc94537ee80cbfa86796378ccc1d4aaf9929492fe04a7cca50';

export function GalleryCodePage({ slug }: { slug: string }) {
  const file = `examples/${slug}.html`;
  const label = GALLERY.find((g) => g.slug === slug)?.label ?? slug;
  const text = useSource(slug);
  const [copy, setCopy] = useState('Copy');
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(reset.current), []);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopy('Copied');
    } catch {
      setCopy('Select + copy');
    }
    clearTimeout(reset.current);
    reset.current = setTimeout(() => setCopy('Copy'), 1400);
  };

  return (
    <NativeChapter slug="code">
      <section className="hero pb-5">
        <nav className="crumbs pb-3" aria-label="Breadcrumb">
          <a href="/gallery" onClick={onStudioLink}>Gallery</a>
          <span className="sep" aria-hidden="true">/</span>
          <a href={`/gallery/${slug}`} onClick={onStudioLink}>{label}</a>
          <span className="sep" aria-hidden="true">/</span>
          <span aria-current="page">Code</span>
        </nav>
        <div className="srchead">
          <h1 id="srctitle">{slug}</h1>
          {' '}
          <span className="srcfile" id="srcfile">{`site/${file}`}</span>
        </div>
      </section>
      <div className="srcwrap">
        <div className="srcbtns">
          <a className="btn btn-secondary sm" id="openlive" href={`/gallery/${slug}`} onClick={onStudioLink}>Open live</a>
          {' '}
          <button className="btn btn-secondary sm" id="copysrc" type="button" disabled={!text} onClick={onCopy}>{copy}</button>
        </div>
        <pre aria-busy={!text || undefined}><code id="srccode">{text}</code></pre>
      </div>
      <footer className="site">
        <span>VERSEVA · open source · MIT</span>
        {' '}
        <span className="badge-line">Built on VERSEVA Design</span>
      </footer>
    </NativeChapter>
  );
}
