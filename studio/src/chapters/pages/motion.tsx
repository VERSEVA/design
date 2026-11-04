// Motion: every specimen as a studio tile (1.7.0 redesign), in the /widgets language.
// The specimens are the frozen site/motion.html markup; the tiles around them are new, and a
// demo's Replay, Roll or Open control sits in its tile's footer. The legacy inline script runs
// as the chapter script for the demos: scoped to the chapter root, listeners on the abort
// signal, frames and timers cancelled, and every change it makes to the DOM undone on cleanup.
// Code panels are the tiles' own.
import { NativeChapter, type ChapterScript } from '../NativeChapter';
import { SpecimenGrid, SpecimenTile, tileIcon } from '../../tiles/SpecimenTile';
import { chapterThemeWipe } from '../themeWipe';
import './motion.css';
/* The sections with a specimen, in page order: sample i of motion.code.json (built by
   studio/scripts/chapter-code.mjs from the frozen page) is the sample of SAMPLED[i]. The samples
   load on first intent, so they stay out of the main chunk. */
export const SAMPLED = ['tokens', 'press', 'entrances', 'lines', 'spotlight', 'magnetic', 'numbers', 'swap', 'attention', 'loading', 'grow', 'ambient', 'wipe'];
let samples: Promise<string[]> | undefined;
const sample = (id: string) => () => (samples ??= import('./motion.code.json').then((m) => m.default, (e) => { samples = undefined; throw e; })).then((c) => c[SAMPLED.indexOf(id)]);

/* One header icon for the chapter. */
const ICON = tileIcon(<path d="M4 19c6 0 6-14 16-14" />);

type Wipe = (e: { clientX?: number; clientY?: number } | null) => void;
declare global { interface Window { versevaThemeWipe?: Wipe } }

export const script: ChapterScript = (root, signal, onCleanup) => {
  const on = <K extends keyof HTMLElementEventMap>(el: Element, type: K, fn: (e: HTMLElementEventMap[K]) => void) =>
    el.addEventListener(type, fn as EventListener, { signal });
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`[id="${id}"]`);
  const frames = new Set<number>();
  const raf = (fn: () => void) => { const id = requestAnimationFrame(() => { frames.delete(id); fn(); }); frames.add(id); return id; };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  onCleanup(() => { frames.forEach(cancelAnimationFrame); timers.forEach(clearTimeout); });
  /* Children the script replaces (the ticker, the resolved skeleton) come back on cleanup. */
  const keep = (el: Element) => { const kids = [...el.childNodes]; onCleanup(() => el.replaceChildren(...kids)); };
  /* Inline styles the demos write (magnet transform and transition, spotlight --mx/--my,
     the replay's emptied animation, the curves' --trav) go back to what was rendered. */
  const styles = [...root.querySelectorAll('*')].map((el) => [el, el.getAttribute('style')] as const);
  onCleanup(() => styles.forEach(([el, v]) => { if (v === null) el.removeAttribute('style'); else el.setAttribute('style', v); }));

  /* theme.js exposed the wipe sitewide; the studio provides it while this chapter is mounted. */
  const prevWipe = window.versevaThemeWipe;
  window.versevaThemeWipe = chapterThemeWipe;
  onCleanup(() => { if (window.versevaThemeWipe === chapterThemeWipe) window.versevaThemeWipe = prevWipe; });
  const wipeBtn = $('wipedemo');
  if (wipeBtn) on(wipeBtn, 'click', (e) => window.versevaThemeWipe!(e));

  // The curves race: same distance, same 600ms, five different personalities.
  const rows = [...root.querySelectorAll<HTMLElement>('#curves .curve')];
  onCleanup(() => rows.forEach((c) => c.classList.remove('go')));
  const fireCurves = () => {
    rows.forEach((c) => {
      const track = c.querySelector<HTMLElement>('.track')!;
      c.style.setProperty('--trav', (track.clientWidth - 20) + 'px');
      c.classList.remove('go');
    });
    raf(() => raf(() => rows.forEach((c) => c.classList.add('go'))));
  };
  const fire = $('firecurves');
  if (fire) on(fire, 'click', fireCurves);

  // Replay a staggered entrance by re-minting the children's animations.
  root.querySelectorAll<HTMLElement>('[data-replay]').forEach((btn) => {
    on(btn, 'click', () => {
      const host = $(btn.dataset.replay!);
      host?.querySelectorAll<HTMLElement>(':scope > *').forEach((el) => {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
      });
    });
  });

  // Line reveal: arm after two frames so the closed state paints first.
  const armLines = (host: HTMLElement) => {
    host.classList.remove('in');
    void host.offsetWidth;
    raf(() => raf(() => host.classList.add('in')));
  };
  const lineDemo = $('linedemo');
  if (lineDemo) { armLines(lineDemo); onCleanup(() => lineDemo.classList.remove('in')); }
  root.querySelectorAll<HTMLElement>('[data-replay-lines]').forEach((btn) => {
    on(btn, 'click', () => { const host = $(btn.dataset.replayLines!); if (host) armLines(host); });
  });

  // Spotlight group: one handler, numbers only; CSS owns the light.
  // Rect reads coalesce to one batch per frame.
  root.querySelectorAll<HTMLElement>('[data-spot]').forEach((group) => {
    let frame = 0;
    let last = { x: 0, y: 0 };
    on(group, 'pointermove', (e) => {
      last = { x: e.clientX, y: e.clientY };
      if (frame) return;
      frame = raf(() => {
        frame = 0;
        group.querySelectorAll<HTMLElement>('.spot').forEach((card) => {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', (last.x - r.left) + 'px');
          card.style.setProperty('--my', (last.y - r.top) + 'px');
        });
      });
    });
  });

  // Magnetic: follow at strength, settle on --ease-back. The home rect is
  // cached at pointerenter (the element is unmoved then), never re-measured
  // mid-follow: a transformed box measuring itself converges wrong and wobbles.
  root.querySelectorAll<HTMLElement>('[data-magnet]').forEach((el) => {
    let home: { cx: number; cy: number } | null = null;
    on(el, 'pointerenter', () => {
      const r = el.getBoundingClientRect();
      home = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
    on(el, 'pointermove', (e) => {
      if (!home || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      el.style.transition = 'none';
      el.style.transform = `translate(${((e.clientX - home.cx) * 0.3).toFixed(1)}px, ${((e.clientY - home.cy) * 0.3).toFixed(1)}px)`;
    });
    on(el, 'pointerleave', () => {
      home = null;
      el.style.transition = 'transform var(--dur-4) var(--ease-back)';
      el.style.transform = 'translate(0,0)';
    });
  });

  // Rolling number: build digit columns once, then just move --d.
  const tick = $('tickdemo');
  const buildTicker = (host: HTMLElement, str: string) => {
    host.textContent = '';
    for (const ch of str) {
      if (/\d/.test(ch)) {
        const col = document.createElement('span');
        col.className = 'td';
        col.setAttribute('aria-hidden', 'true');
        for (let d = 0; d <= 9; d++) { const i = document.createElement('i'); i.textContent = String(d); col.append(i); }
        col.style.setProperty('--d', ch);
        host.append(col);
      } else {
        const s = document.createElement('span');
        s.textContent = ch;
        host.append(s);
      }
    }
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = str;
    host.append(sr);
  };
  if (tick) {
    keep(tick);
    const tickVals = ['112', '148', '093', '127'];
    let tickAt = 0;
    buildTicker(tick, tickVals[0]);
    const roll = $('tickroll');
    if (roll) on(roll, 'click', () => {
      tickAt = (tickAt + 1) % tickVals.length;
      const next = tickVals[tickAt];
      const cols = tick.querySelectorAll<HTMLElement>('.td');
      const digits = next.replace(/\D/g, '');
      if (cols.length === digits.length) {
        cols.forEach((col, i) => col.style.setProperty('--d', digits[i]));
        tick.querySelector('.sr-only')!.textContent = next;
      } else {
        buildTicker(tick, next);
      }
    });
  }

  // Attention: re-mint the finite choreography.
  const attn = $('attndemo');
  const attnFire = $('attnfire');
  if (attn && attnFire) {
    onCleanup(() => attn.classList.remove('attn'));
    on(attnFire, 'click', () => {
      attn.classList.remove('attn');
      void attn.offsetWidth;
      attn.classList.add('attn');
    });
  }

  // Grow: a transition flipped by class; open and close both animate.
  const growBtn = $('growfire');
  const grow = $('growdemo');
  if (growBtn && grow) {
    const label = growBtn.textContent;
    onCleanup(() => { grow.classList.remove('open'); growBtn.setAttribute('aria-expanded', 'false'); growBtn.textContent = label; });
    on(growBtn, 'click', () => {
      const open = grow.classList.toggle('open');
      growBtn.setAttribute('aria-expanded', String(open));
      growBtn.textContent = open ? 'Close it' : 'Open it';
    });
  }

  // Loading: skeletons resolve once into content with one rise beat.
  const skHost = $('skdemo');
  const skLoad = $<HTMLButtonElement>('skload');
  if (skHost && skLoad) {
    keep(skHost);
    onCleanup(() => { skLoad.disabled = false; });
    on(skLoad, 'click', () => {
      skHost.innerHTML = '<div class="mcard mo-rise"><b>Q-2081 · Northline</b><span class="mnote">resolved in one beat, no flicker back</span></div>';
      skLoad.disabled = true;
    });
  }
};

export function Page() {
  return (
    <NativeChapter slug="motion" script={script}>
      <section className="hero">
        <h1>Motion</h1>
      </section>
      <SpecimenGrid>
        <SpecimenTile id="tokens" name="Tokens" icon={ICON} size="xl" meta="10 tokens" code={sample('tokens')}>
          <div className="demo">
            <div className="specimen curverow" id="curves">
              <div className="curve c-standard">
                <span className="cl">--ease-standard</span>
                <span className="track">
                  <span className="ball"></span>
                </span>
              </div>
              <div className="curve c-entrance">
                <span className="cl">--ease-entrance</span>
                <span className="track">
                  <span className="ball"></span>
                </span>
              </div>
              <div className="curve c-emph">
                <span className="cl">--ease-emph</span>
                <span className="track">
                  <span className="ball"></span>
                </span>
              </div>
              <div className="curve c-exit">
                <span className="cl">--ease-exit</span>
                <span className="track">
                  <span className="ball"></span>
                </span>
              </div>
              <div className="curve c-back">
                <span className="cl">--ease-back</span>
                <span className="track">
                  <span className="ball"></span>
                </span>
              </div>
              <div className="replaybar">
                <button className="btn btn-secondary sm" id="firecurves" type="button">Run the curves</button>
              </div>
              <div className="tscroll">
                <table className="ttable">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Value</th>
                      <th>Job</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>--dur-1</td>
                      <td>120ms</td>
                      <td>Press, hover, color shifts</td>
                    </tr>
                    <tr>
                      <td>--dur-2</td>
                      <td>200ms</td>
                      <td>Toggles, switches, chips</td>
                    </tr>
                    <tr>
                      <td>--dur-3</td>
                      <td>320ms</td>
                      <td>Entrances, sheets, disclosure</td>
                    </tr>
                    <tr>
                      <td>--dur-4</td>
                      <td>480ms</td>
                      <td>Orchestrated moments, rare</td>
                    </tr>
                    <tr>
                      <td>--ease-standard</td>
                      <td>cubic-bezier(.2, 0, 0, 1)</td>
                      <td>The default; press and state</td>
                    </tr>
                    <tr>
                      <td>--ease-entrance</td>
                      <td>cubic-bezier(.16, 1, .3, 1)</td>
                      <td>Things arriving</td>
                    </tr>
                    <tr>
                      <td>--ease-emph</td>
                      <td>cubic-bezier(.3, 0, .1, 1)</td>
                      <td>Emphasis, attention</td>
                    </tr>
                    <tr>
                      <td>--ease-exit</td>
                      <td>cubic-bezier(.3, 0, 1, 1)</td>
                      <td>Leaving for good</td>
                    </tr>
                    <tr>
                      <td>--ease-back</td>
                      <td>cubic-bezier(.34, 1.56, .64, 1)</td>
                      <td>Snap-back settle after a drag or magnet</td>
                    </tr>
                    <tr>
                      <td>--ease-spring</td>
                      <td>cubic-bezier(.22, 1, .36, 1)</td>
                      <td>Playful settle, sparing</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="press" name="Press" icon={ICON} size="m" meta="3 buttons" code={sample('press')}>
          <div className="demo">
            <div className="specimen">
              <button className="btn btn-primary" type="button">Sits down 1px</button>
              {' '}
              <button className="btn btn-secondary" type="button">Same idiom</button>
              {' '}
              <button className="btn btn-primary" type="button" disabled>Disabled: still</button>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="entrances" name="Entrances" icon={ICON} size="m" meta="4 cards" code={sample('entrances')} actions={<button className="btn btn-secondary sm" data-replay="stagdemo" type="button">Replay</button>}>
          <div className="demo">
            <div className="specimen mo-st" id="stagdemo">
              <div className="mcard">
                <b>First</b>
                <span className="mnote">0ms</span>
              </div>
              <div className="mcard">
                <b>Second</b>
                <span className="mnote">+60ms</span>
              </div>
              <div className="mcard">
                <b>Third</b>
                <span className="mnote">+120ms</span>
              </div>
              <div className="mcard">
                <b>Fourth</b>
                <span className="mnote">+180ms</span>
              </div>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="lines" name="Line reveal" icon={ICON} size="m" code={sample('lines')} actions={<button className="btn btn-secondary sm" data-replay-lines="linedemo" type="button">Replay</button>}>
          <div className="demo">
            <div className="specimen">
              <span className="mo-lines heroline" id="linedemo">
                <span>
                  <span>Design is the</span>
                </span>
                {' '}
                <span>
                  <span>signature</span>
                </span>
              </span>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="spotlight" name="Spotlight" icon={ICON} size="m" meta="3 cards" code={sample('spotlight')}>
          <div className="demo">
            <div className="specimen sprow gap-5" data-spot="">
              <div className="mcard spot">
                <b>Move across these</b>
                <span className="mnote">the halo tracks the pointer</span>
              </div>
              <div className="mcard spot">
                <b>Neighbors warm early</b>
                <span className="mnote">tracking is on the group</span>
              </div>
              <div className="mcard spot">
                <b>Accent at 10%</b>
                <span className="mnote">never a new color</span>
              </div>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="magnetic" name="Magnetic" icon={ICON} size="m" code={sample('magnetic')}>
          <div className="demo">
            <div className="specimen">
              <span className="magnet" data-magnet="">
                <button className="btn btn-primary" type="button">Come closer</button>
              </span>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="numbers" name="Numbers" icon={ICON} size="m" code={sample('numbers')} actions={<button className="btn btn-secondary sm" id="tickroll" type="button">Roll it</button>}>
          <div className="demo">
            <div className="specimen">
              <span className="statline">
                <span className="ticker" id="tickdemo"></span>
                <span className="unit">/wk</span>
              </span>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="swap" name="Text swap" icon={ICON} size="m" code={sample('swap')}>
          <div className="demo">
            <div className="specimen">
              <span className="swver xswap">
                <span className="xa">v1.0.0 · stable</span>
                <span className="xb" aria-hidden="true">8243358 · signed</span>
              </span>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="attention" name="Attention" icon={ICON} size="m" code={sample('attention')} actions={<button className="btn btn-secondary sm" id="attnfire" type="button">Point at it</button>}>
          <div className="demo">
            <div className="specimen">
              <div className="mcard" id="attndemo">
                <b>Batch size</b>
                <span className="mnote">the field the error points at</span>
              </div>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="loading" name="Loading" icon={ICON} size="m" code={sample('loading')} actions={<button className="btn btn-secondary sm" id="skload" type="button">Resolve it</button>}>
          <div className="demo">
            <div className="specimen skdemo" id="skdemo">
              <span className="skel" style={{ width: "60%" }}></span>
              {' '}
              <span className="skel"></span>
              {' '}
              <span className="skel" style={{ width: "82%" }}></span>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="grow" name="Height + width" icon={ICON} size="m" code={sample('grow')} actions={<button className="btn btn-secondary sm" id="growfire" type="button" aria-expanded="false" aria-controls="growdemo">Open it</button>}>
          <div className="demo">
            <div className="specimen growdemo">
              <div className="grow-y" id="growdemo">
                <div>
                  <div className="inner">
                    <div className="pad">Auto height, travelling. The wrapper animates grid-template-rows; the child clips. No measured pixels, no max-height guesses.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="ambient" name="Ambient" icon={ICON} size="m" code={sample('ambient')}>
          <div className="demo">
            <div className="specimen ambcol gap-5">
              <div className="mcard beam beamcard">
                <b>Border beam</b>
                <span className="mnote">conic accent on a ring mask · 4s</span>
              </div>
              <div className="marq" aria-hidden="true">
                <div className="mrow">
                  <span className="marqitem">Web app UI</span>
                  <span className="marqitem">Decks</span>
                  <span className="marqitem">Docs + PDF</span>
                  <span className="marqitem">Data viz</span>
                  <span className="marqitem">Motion</span>
                </div>
                <div className="mrow">
                  <span className="marqitem">Web app UI</span>
                  <span className="marqitem">Decks</span>
                  <span className="marqitem">Docs + PDF</span>
                  <span className="marqitem">Data viz</span>
                  <span className="marqitem">Motion</span>
                </div>
              </div>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="wipe" name="Theme wipe" icon={ICON} size="m" code={sample('wipe')}>
          <div className="demo">
            <div className="specimen">
              <button className="btn btn-primary" id="wipedemo" type="button">Flip the theme</button>
            </div>
          </div>
        </SpecimenTile>
      </SpecimenGrid>
      <footer className="site">
        <span>VERSEVA · open source · MIT</span>
        {' '}
        <span className="badge-line">Built on VERSEVA Design</span>
      </footer>
    </NativeChapter>
  );
}
