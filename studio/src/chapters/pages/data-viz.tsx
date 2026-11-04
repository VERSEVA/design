// Data viz: every specimen as a studio tile (1.7.0 redesign), in the /widgets language.
// The specimens are this file's markup (parity with the frozen site/data-viz.html is retired),
// and they are the documented recipes, so they keep law 3: one focus tile (Line + area) carries
// the accent ladder and the other tiles draw on the text ladder; magnitude goes through the
// --data ladder by data-l, never inline colour; categories take series identity, never the ladder.
// The legacy inline script runs as the chapter script for the drawing (sparklines, the line
// plot and its range): scoped to the chapter root, listeners on the abort signal, and whatever
// it adds to the DOM removed on cleanup. Code panels are the tiles' own.
import { NativeChapter, type ChapterScript } from '../NativeChapter';
import { SpecimenGrid, SpecimenTile, tileIcon } from '../../tiles/SpecimenTile';
import './data-viz.css';
/* The sections with a specimen, in page order: sample i of data-viz.code.json is the sample of
   SAMPLED[i], generated from these specimens as drawn (studio/test/chapter-code.test.ts holds it
   byte for byte; VSV_WRITE_CODE=1 rewrites it). The samples load on first intent. */
export const SAMPLED = ['stat', 'spark', 'lines', 'bars', 'stacked', 'hbars', 'heat', 'rings', 'gates', 'meaning'];
let samples: Promise<string[]> | undefined;
const sample = (id: string) => () => (samples ??= import('./data-viz.code.json').then((m) => m.default, (e) => { samples = undefined; throw e; })).then((c) => c[SAMPLED.indexOf(id)]);

/* One header icon for the chapter. */
const ICON = tileIcon(<><path d="M4 19h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></>);

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
};

export function Page() {
  return (
    <NativeChapter slug="data-viz" script={script}>
      <section className="hero">
        <h1>Data viz</h1>
      </section>
      <SpecimenGrid>
        <SpecimenTile id="stat" name="Stat tiles" icon={ICON} size="xl" meta="3 stats" code={sample('stat')} focus={false}>
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
        </SpecimenTile>
        <SpecimenTile id="spark" name="Sparklines" icon={ICON} size="m" meta="2 cards" code={sample('spark')} focus={false}>
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
        </SpecimenTile>
        <SpecimenTile id="lines" name="Line + area" icon={ICON} size="m" code={sample('lines')} focus={true}>
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
        </SpecimenTile>
        <SpecimenTile id="bars" name="Bars" icon={ICON} size="m" meta="5 bars" code={sample('bars')} focus={false}>
          <div className="demo">
            <div className="specimen">
              <div className="goal" style={{ width: "280px" }}>
                <div className="goalline" style={{ top: "28%" }}></div>
                <span className="reftag" style={{ top: "28%" }}>GOAL 130</span>
                <div className="bars" style={{ height: "130px" }}>
                  <div className="bar">
                    <span className="vlab">96</span>
                    <div className="fill" style={{ height: "53%" }} data-l="2"></div>
                    <span className="mlab">Mon</span>
                  </div>
                  <div className="bar">
                    <span className="vlab">118</span>
                    <div className="fill" style={{ height: "65%" }} data-l="2"></div>
                    <span className="mlab">Tue</span>
                  </div>
                  <div className="bar">
                    <span className="vlab">74</span>
                    <div className="fill" style={{ height: "41%" }} data-l="1"></div>
                    <span className="mlab">Wed</span>
                  </div>
                  <div className="bar">
                    <span className="vlab">128</span>
                    <div className="fill" style={{ height: "71%" }} data-l="2"></div>
                    <span className="mlab">Thu</span>
                  </div>
                  <div className="bar">
                    <span className="vlab">142</span>
                    <div className="fill" style={{ height: "79%" }} data-l="3"></div>
                    <span className="mlab">Fri</span>
                  </div>
                </div>
              </div>
              <div className="takeaway" style={{ maxWidth: "220px" }}>Friday cleared the goal; Wednesday's dip was the machine-12 changeover.</div>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="stacked" name="Stacked segments" icon={ICON} size="m" meta="3 weeks" code={sample('stacked')} focus={false}>
          <div className="demo">
            <div className="specimen">
              <div className="stackrow">
                <div>
                  <span className="xlabels" style={{ justifyContent: "center" }}>31</span>
                  <div className="stackcol">
                    <i className="s1" style={{ flex: "14" }}>14</i>
                    <i className="s2" style={{ flex: "9" }}>9</i>
                    <i className="s3" style={{ flex: "8" }}>8</i>
                  </div>
                  <span className="mlab">W1</span>
                </div>
                <div>
                  <span className="xlabels" style={{ justifyContent: "center" }}>38</span>
                  <div className="stackcol">
                    <i className="s1" style={{ flex: "15" }}>15</i>
                    <i className="s2" style={{ flex: "12" }}>12</i>
                    <i className="s3" style={{ flex: "11" }}>11</i>
                  </div>
                  <span className="mlab">W2</span>
                </div>
                <div>
                  <span className="xlabels" style={{ justifyContent: "center" }}>47</span>
                  <div className="stackcol">
                    <i className="s1" style={{ flex: "16" }}>16</i>
                    <i className="s2" style={{ flex: "14" }}>14</i>
                    <i className="s3" style={{ flex: "17" }}>17</i>
                  </div>
                  <span className="mlab">W3</span>
                </div>
                <div className="vizlegend vlegcol">
                  <span><i></i>{" Drafted"}</span>
                  <span><i className="alt"></i>{" Priced"}</span>
                  <span><i className="s3"></i>{" Won"}</span>
                </div>
              </div>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="hbars" name="Horizontal bars" icon={ICON} size="m" meta="4 bars" code={sample('hbars')} focus={false}>
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
        </SpecimenTile>
        <SpecimenTile id="heat" name="Intensity + calendar" icon={ICON} size="m" code={sample('heat')} focus={false}>
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
                    <i data-l="0"></i>
                  </span>
                  <span>
                    <i data-l="1"></i>
                  </span>
                  <span>
                    <i data-l="2"></i>
                  </span>
                  <span>
                    <i></i>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </SpecimenTile>
        <SpecimenTile id="rings" name="Rings" icon={ICON} size="m" meta="3 rings" code={sample('rings')} focus={false}>
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
        </SpecimenTile>
        <SpecimenTile id="gates" name="State strips" icon={ICON} size="m" meta="2 rows" code={sample('gates')} focus={false}>
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
        </SpecimenTile>
        <SpecimenTile id="meaning" name="Meaning + provenance" icon={ICON} size="xl" meta="3 rows" code={sample('meaning')} focus={false}>
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
                <span className="srcdot"><i className="neu"></i>{" WEARABLE"}</span>
              </div>
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
