// Ported from site/web-ui.html (frozen): same copy, same specimens, same anchors.
import { NativeChapter } from '../NativeChapter';

export function Page() {
  return (
    <NativeChapter slug="web-ui">
      <section className="hero">
        <h1>Web app UI</h1>
      </section>
      <section className="ch" id="the-ladders">
        <h2>The ladders</h2>
        <div className="tscroll">
          <table className="ttable">
            <thead>
              <tr>
                <th>Role</th>
                <th></th>
                <th>Job</th>
                <th>Floor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>--bg / --surface / --surface-2</td>
                <td>
                  <span className="swatch sw-bg"></span>
                  {' '}
                  <span className="swatch sw-surface"></span>
                  {' '}
                  <span className="swatch sw-surface2"></span>
                </td>
                <td>Canvas and card grounds</td>
                <td>ground</td>
              </tr>
              <tr>
                <td>--text-1 / -2 / -3</td>
                <td>
                  <span className="swatch sw-t1"></span>
                  {' '}
                  <span className="swatch sw-t2"></span>
                  {' '}
                  <span className="swatch sw-t3"></span>
                </td>
                <td>Primary, secondary, hints</td>
                <td>4.5 / 4.5 / 3</td>
              </tr>
              <tr>
                <td>--accent</td>
                <td>
                  <span className="swatch sw-accent"></span>
                </td>
                <td>One per view, matte</td>
                <td>label 4.5</td>
              </tr>
              <tr>
                <td>--success / --warn / --danger</td>
                <td>
                  <span className="swatch sw-success"></span>
                  {' '}
                  <span className="swatch sw-warn"></span>
                  {' '}
                  <span className="swatch sw-danger"></span>
                </td>
                <td>Status on tints, never alone</td>
                <td>4.5 on tint</td>
              </tr>
              <tr>
                <td>--hairline*</td>
                <td></td>
                <td>Decoration only, never a boundary</td>
                <td>none</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="ch" id="type-trio">
        <h2>Type trio</h2>
        <div className="tscroll">
          <table className="ttable">
            <thead>
              <tr>
                <th>Token</th>
                <th>Face</th>
                <th>Job</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>--font-display</td>
                <td>Archivo 650</td>
                <td>Short statements, tight tracking, accent full stop</td>
              </tr>
              <tr>
                <td>--font-sans</td>
                <td>Manrope 400-700</td>
                <td>Everything a human reads; body 13-14px, meta 11-12.5px</td>
              </tr>
              <tr>
                <td>--font-mono</td>
                <td>JetBrains Mono</td>
                <td>Machines: IDs, codes, microlabels to 10px</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="ch" id="radius-press">
        <h2>Radius + press · amended 2026-08-31</h2>
        <div className="tscroll">
          <table className="ttable">
            <thead>
              <tr>
                <th>Surface</th>
                <th>Radius</th>
                <th>Press</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>controls</td>
                <td>10-14 (--r-sm to --r-btn)</td>
                <td>sit down · translateY(1px)</td>
              </tr>
              <tr>
                <td>product cards</td>
                <td>14 (--r-md)</td>
                <td>none</td>
              </tr>
              <tr>
                <td>modals, elevated</td>
                <td>22 (--r-lg)</td>
                <td>none</td>
              </tr>
              <tr>
                <td>sheets</td>
                <td>26-30</td>
                <td>none</td>
              </tr>
              <tr>
                <td>floating / icon controls</td>
                <td>16 within pill frames</td>
                <td>compress · scale(.92-.97)</td>
              </tr>
              <tr>
                <td>chips</td>
                <td>pill</td>
                <td>none</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="ch" id="contract-specimens">
        <h2>Contract specimens</h2>
        <div className="specstack">
          <div>
            <div className="speclabel">buttons · equal-sized pairs, fill decides</div>
            <div className="spec">
              <button className="btn btn-primary" type="button">Primary</button>
              {' '}
              <button className="btn btn-secondary" type="button">Secondary</button>
              {' '}
              <button className="btn btn-ghost" type="button">Ghost</button>
              {' '}
              <button className="btn btn-destructive" type="button">Delete</button>
              {' '}
              <button className="btn btn-primary" type="button" disabled>Disabled</button>
            </div>
          </div>
          <div>
            <div className="speclabel">status · word-carrying chips</div>
            <div className="spec">
              <span className="badge ok">Deployed</span>
              {' '}
              <span className="badge warn">2 pending</span>
              {' '}
              <span className="badge err">1 failing</span>
              {' '}
              <span className="badge neutral">Draft</span>
            </div>
          </div>
          <div>
            <div className="speclabel">card + stat</div>
            <div className="spec">
              <div className="card">
                <div className="hd">
                  <h4>Quote 2081</h4>
                </div>
                <div className="bd">Provenance complete. Ready for review.</div>
                <div className="ft">
                  <button className="btn btn-secondary sm" type="button">Open</button>
                  <button className="btn btn-primary sm" type="button">Approve</button>
                </div>
              </div>
              <div className="stat">
                <div className="num">4.4<i>ms</i></div>
                <div className="lbl">p95 after the sweep</div>
              </div>
            </div>
          </div>
          <div>
            <div className="speclabel">segmented + field</div>
            <div className="spec">
              <div className="seg">
                <button type="button" aria-selected="true">Week</button>
                <button type="button">Month</button>
                <button type="button">Quarter</button>
              </div>
              <div className="field">
                <label htmlFor="spec-name">Client name</label>
                <input id="spec-name" placeholder="Acme Bottling" />
                <div className="help">As it appears on the quote.</div>
              </div>
            </div>
          </div>
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
