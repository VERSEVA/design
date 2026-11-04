// Gallery (1.7.0 redesign): the mock sites as a bento of studio tiles (name and tags in the
// header, a live thumbnail in the body, Live and Code in the footer), filtered by tag; the
// details and inspiration shots as tiles too. Gallery links stay in the shell: Live goes to
// /gallery/<slug>, Code to /gallery/<slug>/code; thumbnails load /examples/*.html, which
// serve as files. The legacy inline script still runs the detail demos, scoped to the
// chapter root, listeners on the abort signal, and every change it makes undone on cleanup.
import { useState } from 'react';
import { NativeChapter, type ChapterScript } from '../NativeChapter';
import { SpecimenGrid, SpecimenTile } from '../../tiles/SpecimenTile';
import { GALLERY } from '../../gallery/examples';
import { META, FILTERS } from '../../gallery/meta';
import { Thumb } from '../../gallery/Thumb';
import '../../gallery/gallery.css';
import './gallery.css';

export const script: ChapterScript = (root, signal, onCleanup) => {
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, type: K, fn: (e: HTMLElementEventMap[K]) => void) =>
    el.addEventListener(type, fn as EventListener, { signal });
  const $ = <T extends Element = HTMLElement>(id: string) => root.querySelector<T>(`[id="${id}"]`)!;
  /* Every attribute the demos render, and the children the script replaces, come back on
     cleanup. Only the details: the bento above is React's own. */
  const attrs = [...root.querySelectorAll('#details ~ .sgrid *')].map((el) => [el, [...el.attributes].map((a) => [a.name, a.value] as const)] as const);
  onCleanup(() => {
    for (const [el, list] of attrs) {
      for (const a of [...el.attributes]) if (!list.some(([n]) => n === a.name)) el.removeAttribute(a.name);
      for (const [n, v] of list) if (el.getAttribute(n) !== v) el.setAttribute(n, v);
    }
  });
  const keep = (el: Element) => { const kids = [...el.childNodes]; onCleanup(() => el.replaceChildren(...kids)); };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  let raf = 0;
  onCleanup(() => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); });

  [['bloom-a', 'bloom-b'], ['bloom-b', 'bloom-a']].forEach(([self, other]) => {
    on($(self), 'click', () => {
      $(self).classList.add('on');
      $(other).classList.remove('on');
    });
  });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const countTo = (el: HTMLElement, n: number) => {
    cancelAnimationFrame(raf);
    if (reduced) { el.textContent = n.toLocaleString('en-US'); return; }
    let cur = 0;
    const step = Math.max(1, Math.round(n / 30));
    const tick = () => {
      cur = Math.min(n, cur + step);
      el.textContent = cur.toLocaleString('en-US');
      if (cur < n) raf = requestAnimationFrame(tick);
    };
    tick();
  };
  const countnum = $('countnum');
  keep(countnum);
  on($('countstat'), 'click', () => countTo(countnum, 2481));
  countTo(countnum, 2481);

  const skelrow = $('skelrow');
  keep(skelrow);
  const realRow = skelrow.innerHTML;
  const showSkeleton = () => {
    skelrow.innerHTML = '<div class="lrow"><span class="avc"></span><span class="tx skelstack"><span class="skel w62"></span><span class="skel w38"></span></span></div>';
    later(() => { skelrow.innerHTML = realRow; }, 1100);
  };
  on(skelrow, 'click', showSkeleton);
  showSkeleton();

  /* The legacy page appended its toast host to <body>; so does the port, and takes it away on cleanup. */
  onCleanup(() => document.getElementById('toastwrap')?.remove());
  on($('toastdemo'), 'click', () => {
    let wrap = document.getElementById('toastwrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toastwrap';
      document.body.append(wrap);
    }
    wrap.replaceChildren();
    const t = document.createElement('div');
    t.className = 'toast ok';
    t.style.position = 'fixed';
    t.style.right = 'var(--s-5)';
    t.style.bottom = 'var(--s-5)';
    t.style.zIndex = '9';
    t.innerHTML = '<span class="dot"></span>Saved';
    wrap.append(t);
    later(() => t.remove(), 2200);
  });

  const switchdemo = $<HTMLInputElement>('switchdemo');
  const switchword = $('switchword');
  keep(switchword);
  const checked = switchdemo.checked;
  onCleanup(() => { switchdemo.checked = checked; });
  on(switchdemo, 'change', () => {
    switchword.textContent = switchdemo.checked ? 'Provenance on' : 'Provenance off';
  });
};

const ALL = GALLERY.length;
const count = (f: string) => GALLERY.filter((g) => META[g.slug].filters.includes(f)).length;

/* The mock sites: filter chips (neutral selection, a count on each), then the bento. */
function MockSites() {
  const [f, setF] = useState('all');
  const chips: ReadonlyArray<readonly [string, string, number]> = [['all', 'All', ALL], ...FILTERS.map(([k, l]) => [k, l, count(k)] as const)];
  return (
    <>
      <div className="chiprow" id="gfilter">
        {chips.map(([k, l, n]) => (
          <button key={k} className="fchip" type="button" aria-pressed={f === k} data-f={k} onClick={() => setF(k)}>{l}<span className="cnt">{n}</span></button>
        ))}
      </div>
      <SpecimenGrid className="gallery">
        {GALLERY.map(({ slug, label }) => {
          const m = META[slug];
          const off = f !== 'all' && !m.filters.includes(f);
          const nameId = `g-${slug}-name`;
          return (
            <SpecimenTile
              key={slug}
              level={3}
              size={m.size}
              className={off ? 'gtile gtile-off' : 'gtile'}
              name={<span id={nameId}>{label}</span>}
              meta={<span className="gtags">{m.tags.map((t) => <span key={t} className="badge neutral">{t}</span>)}</span>}
              actions={<>
                <a className="btn btn-secondary sm" href={`/gallery/${slug}`} aria-describedby={nameId}>Live</a>
                <a className="btn btn-ghost sm" href={`/gallery/${slug}/code`} aria-describedby={nameId}>Code</a>
              </>}
            >
              <Thumb slug={slug} title={label} off={off} />
            </SpecimenTile>
          );
        })}
      </SpecimenGrid>
    </>
  );
}

const RENDERS = [
  ['console-dark', 'Ops console', 'Concept render: dark ops console'],
  ['landing-light', 'Landing page', 'Concept render: light landing page'],
  ['quote-tool-dark', 'Quote tool', 'Concept render: dark quoting tool'],
  ['mobile-dark', 'Mobile app', 'Concept render: mobile app screens'],
] as const;

const concept = <span className="badge neutral">concept</span>;

export function Page() {
  return (
    <NativeChapter slug="gallery" script={script}>
      <section className="hero"><h1>The gallery</h1></section>
      <section className="ch">
        <h2 id="mock-sites">Mock sites</h2>
        <MockSites />
      </section>
      <section className="ch">
        <h2 id="details">Details</h2>
        <SpecimenGrid className="spells">
          <SpecimenTile level={3} size="s" name="Press physics" meta={<span className="badge neutral">law 8</span>}>
            <div className="demo">
              <button className="btn btn-primary" type="button">Hold me down</button>
              <button className="btn btn-secondary" type="button">Me too</button>
            </div>
          </SpecimenTile>
          <SpecimenTile level={3} size="s" name="Accent bloom">
            <div className="demo">
              <span className="bloomtab" id="bloom-a">Overview</span>
              <span className="bloomtab on" id="bloom-b">Quotes</span>
            </div>
          </SpecimenTile>
          <SpecimenTile level={3} size="s" name="Count-up stat">
            <div className="demo">
              <div className="stat tapstat" id="countstat"><div className="num" id="countnum">2,481</div><div className="lbl">Quotes priced</div></div>
            </div>
          </SpecimenTile>
          <SpecimenTile level={3} size="s" name="Skeleton to loaded">
            <div className="demo">
              <div className="lrows taprow" id="skelrow">
                <div className="lrow">
                  <span className="avc">KW</span>
                  <span className="tx"><b>Quote 2081 verified</b><span className="metaline">2 minutes ago</span></span>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile level={3} size="s" name="Toast">
            <div className="demo">
              <button className="btn btn-secondary" type="button" id="toastdemo">Trigger a toast</button>
            </div>
          </SpecimenTile>
          <SpecimenTile level={3} size="s" name="Switch">
            <div className="demo">
              <label className="sel switch-wrap"><input className="sw" type="checkbox" defaultChecked id="switchdemo" /><span className="switch"></span><span id="switchword">Provenance on</span></label>
            </div>
          </SpecimenTile>
        </SpecimenGrid>
      </section>
      <section className="ch">
        <h2 id="inspiration-shots">Inspiration shots</h2>
        <SpecimenGrid className="rendergrid">
          {RENDERS.map(([file, name, alt]) => (
            <SpecimenTile key={file} level={3} size="m" name={name} meta={concept}>
              <img className="grender" src={`/examples/renders/${file}.png`} alt={alt} loading="lazy" />
            </SpecimenTile>
          ))}
        </SpecimenGrid>
      </section>
      <footer className="site">
        <span>VERSEVA · open source · MIT</span>
        {' '}
        <span className="badge-line">Built on VERSEVA Design</span>
      </footer>
    </NativeChapter>
  );
}
