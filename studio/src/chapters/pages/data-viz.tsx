// Ported from site/data-viz.html (frozen): same copy, same specimens, same anchors.
// The legacy inline script runs as the chapter script: scoped to the chapter root,
// listeners on the abort signal, and whatever it adds to the DOM removed on cleanup.
// The docnav scrollspy is left out with the docnav (the studio sidebar spies).
import { NativeChapter, type ChapterScript } from '../NativeChapter';
import './data-viz.css';
/* Built by studio/scripts/chapter-code.mjs from the frozen page: the exact code samples its script showed. */
import CODE from './data-viz.code.json';

/* sha256 of site/data-viz.html; the parity test fails if the frozen page changes. */
export const FROZEN = '66c03ff9190c14707ef38c5e0a20600d51cf28478d0b96c0fce63d8c9ae860ee';

type Pt = [number, number];
const lpts = (vals: number[], W: number, H: number, pad: number, top: number): Pt[] => vals.map((v, i) => [
  pad + (W - pad * 2) * (vals.length === 1 ? 0.5 : i / (vals.length - 1)),
  pad + (H - pad * 2) * (1 - v / top),
]);
const lp = (p: Pt[]) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
const ap = (p: Pt[], H: number, pad: number) => `M${p[0][0].toFixed(1)} ${H - pad} ${lp(p).slice(1)} L${p[p.length - 1][0].toFixed(1)} ${H - pad} Z`;

export const script: ChapterScript = (root, signal, onCleanup) => {
  const on = <K extends keyof HTMLElementEventMap>(el: Element, type: K, fn: (e: HTMLElementEventMap[K]) => void) =>
    el.addEventListener(type, fn as EventListener, { signal });
  const added: Element[] = [];
  onCleanup(() => added.forEach((el) => el.remove()));

  let gid = 0;
  root.querySelectorAll<SVGSVGElement>('[data-spark]').forEach((svg) => {
    const vals = svg.dataset.spark!.split(',').map(Number);
    const top = Math.max(...vals);
    const p = lpts(vals, 140, 40, 4, top);
    const id = `sg${gid++}`;
    svg.innerHTML = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--data-3)" stop-opacity=".26"/><stop offset="1" stop-color="var(--data-3)" stop-opacity="0"/></linearGradient></defs>
      <path d="${ap(p, 40, 4)}" fill="url(#${id})"/>
      <path d="${lp(p)}" fill="none" stroke="var(--data-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${p[p.length - 1][0].toFixed(1)}" cy="${p[p.length - 1][1].toFixed(1)}" r="3" fill="var(--data-3)"/>`;
  });

  const plot = root.querySelector<HTMLElement>('#vseries');
  const plotSvg = plot?.querySelector('svg');
  const xlab = root.querySelector<HTMLElement>('#vxlab');
  if (plot && plotSvg && xlab) {
    const W = 320, PH = 150, PAD = 6;
    let state = 'a';
    let cur: { labels: string[]; s1: number[]; s2: number[]; p1: Pt[]; p2: Pt[] } | null = null;
    const renderPlot = () => {
      const d = plot.dataset;
      const labels = d[`labels${state.toUpperCase()}`]!.split(',');
      const s1 = d[`${state}1`]!.split(',').map(Number);
      const s2 = d[`${state}2`]!.split(',').map(Number);
      const [refV, refLabel] = d[state === 'a' ? 'refa' : 'refb']!.split('|');
      const top = Math.max(...s1, ...s2, +refV);
      const p1 = lpts(s1, W, PH, PAD, top);
      const p2 = lpts(s2, W, PH, PAD, top);
      const refY = PAD + (PH - PAD * 2) * (1 - +refV / top);
      cur = { labels, s1, s2, p1, p2 };
      plotSvg.setAttribute('viewBox', `0 0 ${W} ${PH}`);
      plotSvg.innerHTML = `<defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--data-3)" stop-opacity=".22"/><stop offset="1" stop-color="var(--data-3)" stop-opacity="0"/></linearGradient></defs>
      <line class="refline" x1="${PAD}" y1="${refY.toFixed(1)}" x2="${W - PAD}" y2="${refY.toFixed(1)}"/>
      <path d="${ap(p1, PH, PAD)}" fill="url(#vg)"/>
      <path d="${lp(p1)}" fill="none" stroke="var(--data-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${lp(p2)}" fill="none" stroke="var(--data-alt)" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${p1[p1.length - 1][0].toFixed(1)}" cy="${p1[p1.length - 1][1].toFixed(1)}" r="3" fill="var(--data-3)"/>
      <circle cx="${p2[p2.length - 1][0].toFixed(1)}" cy="${p2[p2.length - 1][1].toFixed(1)}" r="3" fill="var(--data-alt)"/>
      <g id="vcross" hidden></g>`;
      let tag = plot.querySelector<HTMLElement>('.reftag');
      if (!tag) { tag = document.createElement('span'); tag.className = 'reftag'; plot.append(tag); added.push(tag); }
      tag.textContent = refLabel;
      tag.style.top = `${(refY / PH) * 100}%`;
      xlab.innerHTML = `<span>${labels[0]}</span><span>${labels[labels.length - 1]}</span>`;
      plot.querySelector('.viztip')?.remove();
    };
    on(plotSvg as unknown as HTMLElement, 'pointermove', (e) => {
      if (!cur) return;
      const box = plotSvg.getBoundingClientRect();
      const x = ((e.clientX - box.left) / box.width) * W;
      const i = Math.max(0, Math.min(cur.labels.length - 1, Math.round(((x - PAD) / (W - PAD * 2)) * (cur.labels.length - 1))));
      const cross = plotSvg.querySelector<SVGGElement>('#vcross')!;
      cross.removeAttribute('hidden');
      cross.innerHTML = `<line x1="${cur.p1[i][0]}" y1="${PAD}" x2="${cur.p1[i][0]}" y2="${PH - PAD}" stroke="var(--text-3)" stroke-width="1" opacity=".5"/>
      <circle cx="${cur.p1[i][0]}" cy="${cur.p1[i][1]}" r="4" fill="var(--data-3)" stroke="var(--surface)" stroke-width="2"/>
      <circle cx="${cur.p2[i][0]}" cy="${cur.p2[i][1]}" r="4" fill="var(--data-alt)" stroke="var(--surface)" stroke-width="2"/>`;
      let tip = plot.querySelector('.viztip');
      if (!tip) { tip = document.createElement('div'); tip.className = 'viztip'; plot.append(tip); added.push(tip); }
      const names = plot.dataset.names!.split(',');
      tip.innerHTML = `<b>${cur.labels[i]}</b><span>${names[0]} ${cur.s1[i]}</span><span>${names[1]} ${cur.s2[i]}</span>`;
    });
    on(plotSvg as unknown as HTMLElement, 'pointerleave', () => {
      plotSvg.querySelector('#vcross')?.setAttribute('hidden', '');
      plot.querySelector('.viztip')?.remove();
    });
    const range = [...root.querySelectorAll('#vrange button')];
    range.forEach((b, i) => on(b, 'click', () => {
      range.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      state = i === 0 ? 'a' : 'b';
      renderPlot();
    }));
    renderPlot();
  }

  root.querySelectorAll('.comp').forEach((comp) => {
    const demo = comp.querySelector('.demo');
    const cw = comp.querySelector<HTMLElement>('.codewrap');
    if (!demo || !cw) return;
    cw.hidden = true;
    onCleanup(() => { cw.hidden = false; });
    const bar = document.createElement('div');
    bar.className = 'codetoggle';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost sm';
    btn.textContent = 'Show code';
    btn.setAttribute('aria-expanded', 'false');
    on(btn, 'click', () => {
      const show = cw.hidden;
      cw.hidden = !show;
      bar.classList.toggle('opened', show);
      btn.textContent = show ? 'Hide code' : 'Show code';
      btn.setAttribute('aria-expanded', String(show));
    });
    bar.append(btn);
    demo.after(bar);
    bar.after(cw);
    added.push(bar);
  });

  /* Each sample is the text the legacy page built from its specimen (see data-viz.code.json). */
  let n = 0;
  root.querySelectorAll('.comp').forEach((comp) => {
    const code = comp.querySelector('.codewrap code');
    if (!code || !comp.querySelector('.specimen')) return;
    const text = CODE[n++];
    if (!code.textContent!.trim()) code.textContent = text;
  });
  root.querySelectorAll<HTMLButtonElement>('.copybtn').forEach((btn) => {
    let t: ReturnType<typeof setTimeout> | undefined;
    onCleanup(() => clearTimeout(t));
    on(btn, 'click', async () => {
      const code = btn.parentElement!.querySelector('code')!;
      try {
        await navigator.clipboard.writeText(code.textContent!);
        btn.textContent = 'Copied';
      } catch {
        btn.textContent = 'Select + copy';
      }
      clearTimeout(t);
      t = setTimeout(() => { btn.textContent = 'Copy'; }, 1400);
    });
  });
};

export function Page() {
  return (
    <NativeChapter slug="data-viz" script={script}>
      <section className="hero">
        <h1>Data viz</h1>
      </section>
      <div className="docgrid">
        <div className="doccol">
          <section className="comp" id="stat">
            <h2>Stat tiles</h2>
            <div className="demo">
              <div className="specimen">
                <div className="statrow">
                  <div className="stat">
                    <div className="num">45<i>%</i></div>
                    <div className="lbl">Win rate · 14 of 31 decided</div>
                    <div className="microbar">
                      <i style={{ width: "45%" }}></i>
                    </div>
                  </div>
                  <div className="stat">
                    <div className="num">4.4<i>ms</i></div>
                    <div className="lbl">p95 after the sweep</div>
                    <div className="delta">
                      <span className="trend good">↓ −1,709 ms</span>
                    </div>
                  </div>
                  <div className="stat">
                    <div className="num">23:18</div>
                    <div className="lbl">5K best · set yesterday</div>
                    <div className="delta">
                      <span className="trend good">↓ −52 s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="codewrap">
              <button className="btn btn-secondary sm copybtn" type="button">Copy</button>
              <pre><code></code></pre>
            </div>
          </section>
          <section className="comp" id="spark">
            <h2>Sparklines</h2>
            <div className="demo">
              <div className="specimen">
                <div className="vcard">
                  <div className="vh">
                    <b>Quotes priced</b>
                    <span className="src">DESK · LIVE</span>
                  </div>
                  <div className="vh mt-2">
                    <span className="bignum">{"112 "}<small>/ wk</small></span>
                    <span className="trend good">↑ +8</span>
                  </div>
                  <span className="spark mt-2" style={{ display: "block" }}>
                    <svg viewBox="0 0 140 40" preserveAspectRatio="none" aria-hidden="true" data-spark="62,70,66,74,82,78,88,95,90,98,104,112"></svg>
                  </span>
                </div>
                <div className="vcard">
                  <div className="vh">
                    <b>Verify kill rate</b>
                    <span className="src">GATES · 30 D</span>
                  </div>
                  <div className="vh mt-2">
                    <span className="bignum">6<small>%</small></span>
                    <span className="trend bad">↑ +2%</span>
                  </div>
                  <span className="spark mt-2" style={{ display: "block" }}>
                    <svg viewBox="0 0 140 40" preserveAspectRatio="none" aria-hidden="true" data-spark="2,3,2,4,3,5,4,4,6,5,6,6"></svg>
                  </span>
                </div>
              </div>
            </div>
            <div className="codewrap">
              <button className="btn btn-secondary sm copybtn" type="button">Copy</button>
              <pre><code></code></pre>
            </div>
          </section>
          <section className="comp" id="lines">
            <h2>Line + area</h2>
            <div className="demo">
              <div className="specimen" style={{ flex: "1", minWidth: "280px" }}>
                <div className="seg mb-4" id="vrange">
                  <button type="button" aria-selected="true">12 weeks</button>
                  <button type="button" aria-selected="false">30 days</button>
                </div>
                <div className="vizplot" id="vseries" style={{ height: "150px" }} data-labels-a="W1,W2,W3,W4,W5,W6,W7,W8,W9,W10,W11,W12" data-a1="62,70,66,74,82,78,88,95,90,98,104,112" data-a2="41,44,40,52,58,55,61,72,66,74,79,84" data-refa="76|YOUR AVG · 12 WK" data-labels-b="D1,D5,D10,D15,D20,D25,D30" data-b1="88,95,90,98,104,112,118" data-b2="61,72,66,74,79,84,90" data-refb="94|YOUR AVG · 30 D" data-names="Priced,Won">
                  <svg preserveAspectRatio="none" role="img" aria-label="Priced vs won"></svg>
                </div>
                <div className="xlabels mt-2" id="vxlab"></div>
                <div className="vizlegend mt-2">
                  <span><i></i>{" Priced"}</span>
                  <span><i className="alt"></i>{" Won"}</span>
                </div>
                <div className="takeaway">Won tracks priced with a one-week lag; the gap narrowed after rate card v18.</div>
              </div>
            </div>
            <div className="codewrap">
              <button className="btn btn-secondary sm copybtn" type="button">Copy</button>
              <pre><code></code></pre>
            </div>
          </section>
          <section className="comp" id="bars">
            <h2>Bars</h2>
            <div className="demo">
              <div className="specimen">
                <div className="goal" style={{ width: "280px" }}>
                  <div className="goalline" style={{ top: "28%" }}></div>
                  <span className="reftag" style={{ top: "28%" }}>GOAL 130</span>
                  <div className="bars" style={{ height: "130px" }}>
                    <div className="bar">
                      <span className="vlab">96</span>
                      <div className="fill" style={{ height: "53%", background: "var(--data-2)" }}></div>
                      <span className="mlab">Mon</span>
                    </div>
                    <div className="bar">
                      <span className="vlab">118</span>
                      <div className="fill" style={{ height: "65%", background: "var(--data-2)" }}></div>
                      <span className="mlab">Tue</span>
                    </div>
                    <div className="bar">
                      <span className="vlab">74</span>
                      <div className="fill" style={{ height: "41%", background: "var(--data-1)" }}></div>
                      <span className="mlab">Wed</span>
                    </div>
                    <div className="bar">
                      <span className="vlab">128</span>
                      <div className="fill" style={{ height: "71%", background: "var(--data-2)" }}></div>
                      <span className="mlab">Thu</span>
                    </div>
                    <div className="bar">
                      <span className="vlab">142</span>
                      <div className="fill" style={{ height: "79%", background: "var(--data-3)" }}></div>
                      <span className="mlab">Fri</span>
                    </div>
                  </div>
                </div>
                <div className="takeaway" style={{ maxWidth: "220px" }}>Friday cleared the goal; Wednesday's dip was the machine-12 changeover.</div>
              </div>
            </div>
            <div className="codewrap">
              <button className="btn btn-secondary sm copybtn" type="button">Copy</button>
              <pre><code></code></pre>
            </div>
          </section>
          <section className="comp" id="stacked">
            <h2>Stacked segments</h2>
            <div className="demo">
              <div className="specimen">
                <div className="stackrow">
                  <div>
                    <span className="xlabels" style={{ justifyContent: "center" }}>31</span>
                    <div className="stackcol">
                      <i style={{ flex: "14", background: "var(--data-1)" }}>14</i>
                      <i style={{ flex: "9", background: "var(--data-2)" }}>9</i>
                      <i style={{ flex: "8", background: "var(--data-3)" }}>8</i>
                    </div>
                    <span className="mlab">W1</span>
                  </div>
                  <div>
                    <span className="xlabels" style={{ justifyContent: "center" }}>38</span>
                    <div className="stackcol">
                      <i style={{ flex: "15", background: "var(--data-1)" }}>15</i>
                      <i style={{ flex: "12", background: "var(--data-2)" }}>12</i>
                      <i style={{ flex: "11", background: "var(--data-3)" }}>11</i>
                    </div>
                    <span className="mlab">W2</span>
                  </div>
                  <div>
                    <span className="xlabels" style={{ justifyContent: "center" }}>47</span>
                    <div className="stackcol">
                      <i style={{ flex: "16", background: "var(--data-1)" }}>16</i>
                      <i style={{ flex: "14", background: "var(--data-2)" }}>14</i>
                      <i style={{ flex: "17", background: "var(--data-3)" }}>17</i>
                    </div>
                    <span className="mlab">W3</span>
                  </div>
                  <div className="vizlegend vlegcol">
                    <span><i style={{ background: "var(--data-1)" }}></i>{" Drafted"}</span>
                    <span><i style={{ background: "var(--data-2)" }}></i>{" Priced"}</span>
                    <span><i></i>{" Won"}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="codewrap">
              <button className="btn btn-secondary sm copybtn" type="button">Copy</button>
              <pre><code></code></pre>
            </div>
          </section>
          <section className="comp" id="hbars">
            <h2>Horizontal bars</h2>
            <div className="demo">
              <div className="specimen" style={{ minWidth: "300px", flex: "1" }}>
                <div className="hbars">
                  <div className="hbar">
                    <span className="hlabel">Bottling</span>
                    <span className="htrack">
                      <i style={{ width: "100%" }}></i>
                    </span>
                    <span className="hcount">48</span>
                  </div>
                  <div className="hbar">
                    <span className="hlabel">Labeling</span>
                    <span className="htrack">
                      <i style={{ width: "65%" }}></i>
                    </span>
                    <span className="hcount">31</span>
                  </div>
                  <div className="hbar">
                    <span className="hlabel">Kitting</span>
                    <span className="htrack">
                      <i style={{ width: "38%" }}></i>
                    </span>
                    <span className="hcount">18</span>
                  </div>
                  <div className="hbar">
                    <span className="hlabel">Sourcing</span>
                    <span className="htrack">
                      <i style={{ width: "23%" }}></i>
                    </span>
                    <span className="hcount">11</span>
                  </div>
                </div>
                <div className="takeaway">Bottling carries the quarter; kitting demand doubled since v18.</div>
              </div>
            </div>
            <div className="codewrap">
              <button className="btn btn-secondary sm copybtn" type="button">Copy</button>
              <pre><code></code></pre>
            </div>
          </section>
          <section className="comp" id="heat">
            <h2>Intensity + calendar</h2>
            <div className="demo">
              <div className="specimen">
                <div>
                  <span className="speclabel">12-week strip</span>
                  {' '}
                  <span className="actstrip" style={{ gridAutoColumns: "14px" }}>
                    <i data-l="1"></i>
                    <i data-l="2"></i>
                    <i></i>
                    <i data-l="1"></i>
                    <i data-l="3"></i>
                    <i data-l="2"></i>
                    <i data-l="1"></i>
                    <i data-l="2"></i>
                    <i data-l="3"></i>
                    <i data-l="2"></i>
                    <i data-l="3"></i>
                    <i data-l="3" className="today"></i>
                  </span>
                </div>
                <div>
                  <span className="speclabel">month · Less → More</span>
                  <div className="actcal" style={{ width: "196px" }}>
                    <i></i>
                    <i data-l="1"></i>
                    <i data-l="1"></i>
                    <i data-l="2"></i>
                    <i></i>
                    <i data-l="3"></i>
                    <i data-l="2"></i>
                    {' '}
                    <i data-l="1"></i>
                    <i data-l="2"></i>
                    <i></i>
                    <i data-l="2"></i>
                    <i data-l="3"></i>
                    <i data-l="1"></i>
                    <i></i>
                    {' '}
                    <i data-l="2"></i>
                    <i data-l="3"></i>
                    <i data-l="2"></i>
                    <i data-l="1"></i>
                    <i data-l="3"></i>
                    <i data-l="2"></i>
                    <i data-l="3"></i>
                    {' '}
                    <i data-l="1"></i>
                    <i></i>
                    <i data-l="2"></i>
                    <i data-l="3" className="today"></i>
                    <i></i>
                    <i></i>
                    <i></i>
                  </div>
                  <div className="vizlegend mt-2">
                    <span>
                      <i style={{ background: "var(--data-0)" }}></i>
                    </span>
                    <span>
                      <i style={{ background: "var(--data-1)" }}></i>
                    </span>
                    <span>
                      <i style={{ background: "var(--data-2)" }}></i>
                    </span>
                    <span>
                      <i></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="codewrap">
              <button className="btn btn-secondary sm copybtn" type="button">Copy</button>
              <pre><code></code></pre>
            </div>
          </section>
          <section className="comp" id="rings">
            <h2>Rings</h2>
            <div className="demo">
              <div className="specimen">
                <span className="ring" role="img" aria-label="Readiness 72 of 100">
                  <span className="rdial">
                    <svg width="74" height="74" viewBox="0 0 74 74">
                      <circle className="ringtrack" cx="37" cy="37" r="30"></circle>
                      <circle className="ringfill" cx="37" cy="37" r="30" strokeDasharray="188.5" strokeDashoffset="52.8"></circle>
                    </svg>
                    <span className="rv">
                      <b>72</b>
                    </span>
                  </span>
                  {' '}
                  <small className="rlbl">READY</small>
                </span>
                {' '}
                <span className="ring" role="img" aria-label="1,059 kilocalories left, 45 percent consumed">
                  <span className="rdial">
                    <svg width="92" height="92" viewBox="0 0 92 92">
                      <circle className="ringtrack" cx="46" cy="46" r="39"></circle>
                      <circle className="ringfill" cx="46" cy="46" r="39" strokeDasharray="245.0" strokeDashoffset="134.8"></circle>
                    </svg>
                    <span className="rv">
                      <b>1,059</b>
                    </span>
                  </span>
                  {' '}
                  <small className="rlbl">KCAL LEFT</small>
                </span>
                {' '}
                <span className="ring" role="img" aria-label="Provenance 88 percent complete">
                  <span className="rdial">
                    <svg width="74" height="74" viewBox="0 0 74 74">
                      <circle className="ringtrack" cx="37" cy="37" r="30"></circle>
                      <circle className="ringfill" cx="37" cy="37" r="30" strokeDasharray="188.5" strokeDashoffset="22.6"></circle>
                    </svg>
                    <span className="rv">
                      <b>88%</b>
                    </span>
                  </span>
                  {' '}
                  <small className="rlbl">SOURCED</small>
                </span>
              </div>
            </div>
            <div className="codewrap">
              <button className="btn btn-secondary sm copybtn" type="button">Copy</button>
              <pre><code></code></pre>
            </div>
          </section>
          <section className="comp" id="gates">
            <h2>State strips</h2>
            <div className="demo">
              <div className="specimen">
                <div className="lrows" style={{ minWidth: "300px" }}>
                  <div className="lrow">
                    <span className="tx">
                      <b>Q-2081 · Northline</b>
                      <span className="metaline">gate 6 of 9 · verifying</span>
                    </span>
                    <span className="markstrip" title="6 of 9 cleared, now verifying" aria-label="6 of 9 gates cleared, current stage verifying">
                      <i className="cleared"></i>
                      <i className="cleared"></i>
                      <i className="cleared"></i>
                      <i className="cleared"></i>
                      <i className="cleared"></i>
                      <i className="cleared"></i>
                      <i className="current"></i>
                      <i></i>
                      <i></i>
                    </span>
                  </div>
                  <div className="lrow">
                    <span className="tx">
                      <b>Q-2080 · Harbor</b>
                      <span className="metaline">gate 3 of 9 · sourcing blocked</span>
                    </span>
                    <span className="markstrip" title="2 cleared, attention on sourcing" aria-label="2 of 9 gates cleared, attention on sourcing">
                      <i className="cleared"></i>
                      <i className="cleared"></i>
                      <i className="attention"></i>
                      <i></i>
                      <i></i>
                      <i></i>
                      <i></i>
                      <i></i>
                      <i></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="codewrap">
              <button className="btn btn-secondary sm copybtn" type="button">Copy</button>
              <pre><code></code></pre>
            </div>
          </section>
          <section className="comp" id="meaning">
            <h2>Meaning + provenance</h2>
            <div className="demo">
              <div className="specimen">
                <div className="lrows" style={{ minWidth: "300px" }}>
                  <div className="lrow">
                    <span className="tx">
                      <b>5K time</b>
                      <span className="metaline">was 24:10</span>
                    </span>
                    <span className="trend good">↓ −52 s</span>
                  </div>
                  <div className="lrow">
                    <span className="tx">
                      <b>Bench press</b>
                      <span className="metaline">was 80 kg</span>
                    </span>
                    <span className="trend good">↑ +4 kg</span>
                  </div>
                  <div className="lrow">
                    <span className="tx">
                      <b>Verify kill rate</b>
                      <span className="metaline">was 4%</span>
                    </span>
                    <span className="trend bad">↑ +2%</span>
                  </div>
                </div>
                <div className="chips tight">
                  <span className="srcdot"><i className="mom"></i>{" DESK"}</span>
                  <span className="srcdot"><i></i>{" ERP IMPORT"}</span>
                  <span className="srcdot"><i style={{ background: "var(--success)" }}></i>{" WEARABLE"}</span>
                </div>
              </div>
            </div>
            <div className="codewrap">
              <button className="btn btn-secondary sm copybtn" type="button">Copy</button>
              <pre><code></code></pre>
            </div>
          </section>
        </div>
      </div>
      <footer className="site">
        <span>VERSEVA · open source · MIT</span>
        {' '}
        <span className="badge-line">Built on VERSEVA Design</span>
      </footer>
    </NativeChapter>
  );
}
