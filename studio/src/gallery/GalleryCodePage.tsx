// A gallery example's source inside the studio shell, in a studio tile (1.7.0): the file
// in the header, the source in the body, Open live and Copy in the footer. The slug comes from the route; the source is the served file
// /examples/<slug>.html, bundled as its own chunk (sources.ts), so the pre-rendered page
// holds the real text and the main bundle carries none of it.
import { useEffect, useRef, useState } from 'react';
import { NativeChapter } from '../chapters/NativeChapter';
import { onStudioLink } from '../shell/router';
import { GALLERY } from './examples';
import { useSource } from './sources';
import { META } from './meta';
import { SpecimenTile } from '../tiles/SpecimenTile';
import './code.css';
import './gallery.css';

export function GalleryCodePage({ slug }: { slug: string }) {
  const file = `examples/${slug}.html`;
  const label = GALLERY.find((g) => g.slug === slug)?.label ?? slug;
  const { text, failed, retry } = useSource(slug);
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
          <h1 id="srctitle">{label}</h1>
        </div>
      </section>
      <SpecimenTile
        className="gsrc-tile"
        size="xl"
        name={`site/${file}`}
        meta={META[slug] && <span className="gtags">{META[slug].tags.map((t) => <span key={t} className="badge neutral">{t}</span>)}</span>}
        actions={<>
          <a className="btn btn-secondary sm" id="openlive" href={`/gallery/${slug}`} onClick={onStudioLink}>Open live</a>
          <button className="btn btn-ghost sm" id="copysrc" type="button" disabled={!text} onClick={onCopy}><span aria-live="polite">{copy}</span></button>
        </>}
      >
        {failed ? (
          <div className="wtile-err srcerr" role="alert">
            <span className="wtile-errline">Source failed to load</span>
            <button className="btn btn-secondary sm" id="retrysrc" type="button" onClick={retry}>Retry</button>
          </div>
        ) : <pre className="stile-code srcpre" tabIndex={0} aria-label={`site/${file}`} aria-busy={!text || undefined}><code id="srccode">{text}</code></pre>}
      </SpecimenTile>
      <footer className="site">
        <span>VERSEVA · open source · MIT</span>
        {' '}
        <span className="badge-line">Built on VERSEVA Design</span>
      </footer>
    </NativeChapter>
  );
}
