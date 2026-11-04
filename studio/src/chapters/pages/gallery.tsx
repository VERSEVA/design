// Ported from site/examples.html (frozen): same copy, same specimens, same anchors.
// The legacy inline script runs as the chapter script: scoped to the chapter root,
// listeners on the abort signal, and every change it makes to the DOM undone on
// cleanup. Gallery links stay in the shell: Open goes to /gallery/<slug>, Code to
// /gallery/<slug>/code; the preview iframes keep loading /examples/*.html, which
// serve as files.
import { NativeChapter, type ChapterScript } from '../NativeChapter';
import { watchFrames } from '../../front/frameSync';
import './gallery.css';

/* sha256 of site/examples.html; the parity test fails if the frozen page changes. */
export const FROZEN = '83b74a36a7b6aa7078510efb1db2a628e28c66824b6fb0738cc5a2f2f643bf23';

export const script: ChapterScript = (root, signal, onCleanup) => {
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, type: K, fn: (e: HTMLElementEventMap[K]) => void) =>
    el.addEventListener(type, fn as EventListener, { signal });
  const $ = <T extends Element = HTMLElement>(id: string) => root.querySelector<T>(`[id="${id}"]`)!;
  /* Every attribute as rendered, and the children the script replaces, come back on cleanup. */
  const attrs = [...root.querySelectorAll('*')].map((el) => [el, [...el.attributes].map((a) => [a.name, a.value] as const)] as const);
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

  const scalePreviews = () => {
    root.querySelectorAll<HTMLIFrameElement>('.prevbox iframe').forEach((f) => {
      f.style.transform = 'scale(' + f.parentElement!.clientWidth / 1280 + ')';
    });
  };
  on(window, 'resize', scalePreviews);
  scalePreviews();
  /* The previews follow the studio theme and brand, as the iframe embed's nested frames did. */
  onCleanup(watchFrames(root));

  on($('gfilter'), 'click', (e) => {
    const chip = (e.target as Element).closest<HTMLElement>('.fchip');
    if (!chip) return;
    root.querySelectorAll('#gfilter .fchip').forEach((c) => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
    const f = chip.dataset.f!;
    root.querySelectorAll<HTMLElement>('.gallery .gcard').forEach((card) => {
      card.classList.toggle('hidden', f !== 'all' && !card.dataset.tags!.split(' ').includes(f));
    });
    scalePreviews();
  });

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
    t.innerHTML = '<span class="dot"></span>Saved. The word does the work; the dot just nods.';
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

export function Page() {
  return (
    <NativeChapter slug="gallery" script={script}>
      <section className="hero"><h1>The gallery</h1></section>
      <section className="ch">
        <h2 id="mock-sites">Mock sites</h2>
        <div className="chiprow" id="gfilter">
          <button className="fchip" type="button" aria-pressed="true" data-f="all">{"All "}<span className="cnt">8</span></button>
          {' '}
          <button className="fchip" type="button" aria-pressed="false" data-f="data">Data</button>
          {' '}
          <button className="fchip" type="button" aria-pressed="false" data-f="motion">Motion</button>
          {' '}
          <button className="fchip" type="button" aria-pressed="false" data-f="dark">Dark</button>
          {' '}
          <button className="fchip" type="button" aria-pressed="false" data-f="light">Light</button>
          {' '}
          <button className="fchip" type="button" aria-pressed="false" data-f="console">Console</button>
          {' '}
          <button className="fchip" type="button" aria-pressed="false" data-f="tool">Tool</button>
          {' '}
          <button className="fchip" type="button" aria-pressed="false" data-f="commerce">Commerce</button>
          {' '}
          <button className="fchip" type="button" aria-pressed="false" data-f="portfolio">Portfolio</button>
          {' '}
          <button className="fchip" type="button" aria-pressed="false" data-f="3d">3D</button>
        </div>
        <div className="gallery">
          <div className="gcard" data-tags="dark 3d">
            <a className="prevlink" href="/gallery/three-hero" aria-label="Open the 3D hero live"><span className="prevbox"><iframe src="/examples/three-hero.html" loading="lazy" title="3D hero preview" tabIndex={-1}></iframe></span></a>
            {' '}
            <div className="gcap">
              <div className="row">
                <b>Signal Foundry · 3D hero</b>
                <span className="acts"><a className="open" href="/gallery/three-hero">Open</a><a className="open" href="/gallery/three-hero/code">Code</a></span>
              </div>
              <span className="gtags"><span className="gtag">three.js</span><span className="gtag">dark</span><span className="gtag">tokens at runtime</span></span>
            </div>
          </div>
          <div className="gcard" data-tags="dark data console">
            <a className="prevlink" href="/gallery/pulse" aria-label="Open Pulse analytics live"><span className="prevbox"><iframe src="/examples/pulse.html" loading="lazy" title="Pulse analytics preview" tabIndex={-1}></iframe></span></a>
            {' '}
            <div className="gcap">
              <div className="row">
                <b>Pulse · analytics</b>
                <span className="acts"><a className="open" href="/gallery/pulse">Open</a><a className="open" href="/gallery/pulse/code">Code</a></span>
              </div>
              <span className="gtags"><span className="gtag">the viz kit assembled</span><span className="gtag">crosshair hover</span><span className="gtag">dark</span></span>
            </div>
          </div>
          <div className="gcard" data-tags="dark motion landing">
            <a className="prevlink" href="/gallery/launch" aria-label="Open the Launch page live"><span className="prevbox"><iframe src="/examples/launch.html" loading="lazy" title="Launch page preview" tabIndex={-1}></iframe></span></a>
            {' '}
            <div className="gcap">
              <div className="row">
                <b>Launch · the motion kit</b>
                <span className="acts"><a className="open" href="/gallery/launch">Open</a><a className="open" href="/gallery/launch/code">Code</a></span>
              </div>
              <span className="gtags"><span className="gtag">line reveal</span><span className="gtag">theme wipe</span><span className="gtag">rolling stats</span></span>
            </div>
          </div>
          <div className="gcard" data-tags="dark console">
            <a className="prevlink" href="/gallery/console" aria-label="Open the ops console live"><span className="prevbox"><iframe src="/examples/console.html" loading="lazy" title="Ops console preview" tabIndex={-1}></iframe></span></a>
            {' '}
            <div className="gcap">
              <div className="row">
                <b>Ops console</b>
                <span className="acts"><a className="open" href="/gallery/console">Open</a><a className="open" href="/gallery/console/code">Code</a></span>
              </div>
              <span className="gtags"><span className="gtag">org switcher</span><span className="gtag">rail</span><span className="gtag">dark</span></span>
            </div>
          </div>
          <div className="gcard" data-tags="dark tool">
            <a className="prevlink" href="/gallery/quote-tool" aria-label="Open the quote tool live"><span className="prevbox"><iframe src="/examples/quote-tool.html" loading="lazy" title="Quote tool preview" tabIndex={-1}></iframe></span></a>
            {' '}
            <div className="gcap">
              <div className="row">
                <b>Quote tool</b>
                <span className="acts"><a className="open" href="/gallery/quote-tool">Open</a><a className="open" href="/gallery/quote-tool/code">Code</a></span>
              </div>
              <span className="gtags"><span className="gtag">live recompute</span><span className="gtag">state machine</span><span className="gtag">dark</span></span>
            </div>
          </div>
          <div className="gcard" data-tags="light commerce">
            <a className="prevlink" href="/gallery/store" aria-label="Open the storefront live"><span className="prevbox"><iframe src="/examples/store.html" loading="lazy" title="Storefront preview" tabIndex={-1}></iframe></span></a>
            {' '}
            <div className="gcap">
              <div className="row">
                <b>Redline Supply · storefront</b>
                <span className="acts"><a className="open" href="/gallery/store">Open</a><a className="open" href="/gallery/store/code">Code</a></span>
              </div>
              <span className="gtags"><span className="gtag">generated asset</span><span className="gtag">working cart</span><span className="gtag">light</span></span>
            </div>
          </div>
          <div className="gcard" data-tags="dark portfolio">
            <a className="prevlink" href="/gallery/studio" aria-label="Open the studio site live"><span className="prevbox"><iframe src="/examples/studio.html" loading="lazy" title="Studio site preview" tabIndex={-1}></iframe></span></a>
            {' '}
            <div className="gcap">
              <div className="row">
                <b>Foundry Nine · studio</b>
                <span className="acts"><a className="open" href="/gallery/studio">Open</a><a className="open" href="/gallery/studio/code">Code</a></span>
              </div>
              <span className="gtags"><span className="gtag">generated covers</span><span className="gtag">tag filter</span><span className="gtag">dark</span></span>
            </div>
          </div>
          <div className="gcard" data-tags="light landing">
            <a className="prevlink" href="/gallery/landing" aria-label="Open the landing page live"><span className="prevbox"><iframe src="/examples/landing.html" loading="lazy" title="Landing page preview" tabIndex={-1}></iframe></span></a>
            {' '}
            <div className="gcap">
              <div className="row">
                <b>Ledgerline · landing</b>
                <span className="acts"><a className="open" href="/gallery/landing">Open</a><a className="open" href="/gallery/landing/code">Code</a></span>
              </div>
              <span className="gtags"><span className="gtag">working modal</span><span className="gtag">validation</span><span className="gtag">light</span></span>
            </div>
          </div>
        </div>
      </section>
      <section className="ch">
        <h2 id="details">Details</h2>
        <div className="spells">
          <div className="spell">
            <span className="speclabel">press physics · law 8</span>
            <div className="demo">
              <button className="btn btn-primary" type="button">Hold me down</button>
              <button className="btn btn-secondary" type="button">Me too</button>
            </div>
          </div>
          <div className="spell">
            <span className="speclabel">accent bloom · named device</span>
            <div className="demo">
              <span className="bloomtab" id="bloom-a">Overview</span>
              <span className="bloomtab on" id="bloom-b">Quotes</span>
            </div>
          </div>
          <div className="spell">
            <span className="speclabel">count-up stat · tap to rerun</span>
            <div className="demo">
              <div className="stat tapstat" id="countstat"><div className="num" id="countnum">2,481</div><div className="lbl">Quotes priced</div></div>
            </div>
          </div>
          <div className="spell">
            <span className="speclabel">skeleton to loaded · tap to reload</span>
            <div className="demo">
              <div className="lrows taprow" id="skelrow">
                <div className="lrow">
                  <span className="avc">KW</span>
                  <span className="tx"><b>Quote 2081 verified</b><span className="metaline">2 minutes ago</span></span>
                </div>
              </div>
            </div>
          </div>
          <div className="spell">
            <span className="speclabel">toast choreography</span>
            <div className="demo">
              <button className="btn btn-secondary" type="button" id="toastdemo">Trigger a toast</button>
            </div>
          </div>
          <div className="spell">
            <span className="speclabel">switch · state color carries a word</span>
            <div className="demo">
              <label className="sel switch-wrap"><input className="sw" type="checkbox" defaultChecked id="switchdemo" /><span className="switch"></span><span id="switchword">Provenance on</span></label>
            </div>
          </div>
        </div>
      </section>
      <section className="ch">
        <h2 id="inspiration-shots">Inspiration shots</h2>
        <div className="rendergrid">
          <figure className="render">
            <img src="/examples/renders/console-dark.png" alt="Concept render: dark ops console" loading="lazy" />
            <figcaption>concept · not code</figcaption>
          </figure>
          <figure className="render">
            <img src="/examples/renders/landing-light.png" alt="Concept render: light landing page" loading="lazy" />
            <figcaption>concept · not code</figcaption>
          </figure>
          <figure className="render">
            <img src="/examples/renders/quote-tool-dark.png" alt="Concept render: dark quoting tool" loading="lazy" />
            <figcaption>concept · not code</figcaption>
          </figure>
          <figure className="render">
            <img src="/examples/renders/mobile-dark.png" alt="Concept render: mobile app screens" loading="lazy" />
            <figcaption>concept · not code</figcaption>
          </figure>
        </div>
      </section>
      <footer className="site">
        <span>VERSEVA · open source · MIT</span>
        {' '}
        <span className="badge-line">Built on VERSEVA Design</span>
      </footer>
    </NativeChapter>
  );
}
