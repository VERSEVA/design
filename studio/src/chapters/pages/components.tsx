// Components: every specimen as a studio tile (1.7.0 redesign), in the /widgets language.
// The specimens are the frozen site/components.html markup; the tiles around them are new.
// The legacy inline script runs as the chapter script for the demos (tabs, menus, erase,
// bulk, accordion nav): scoped to the chapter root, listeners on the abort signal, and
// every change it makes to the DOM undone on cleanup. Code panels are the tiles' own.
import type React from 'react';
import { NativeChapter, type ChapterScript } from '../NativeChapter';
import { SpecimenGrid, SpecimenTile, tileIcon } from '../../tiles/SpecimenTile';
import './components.css';
/* The sections with a specimen, in page order: sample i of components.code.json (built by
   studio/scripts/chapter-code.mjs from the frozen page) is the sample of SAMPLED[i]. The samples
   load on first intent, so they stay out of the main chunk. */
export const SAMPLED = ['spacing', 'button', 'field', 'switch', 'permission-picking', 'sel-two-line', 'card', 'glass', 'badge', 'toast', 'modal', 'erase', 'table', 'table-pin', 'bulk', 'stat', 'chart', 'seg', 'fchip', 'search', 'rows', 'kv', 'tline', 'skeleton', 'select', 'tabs', 'menu', 'rowmenu', 'tooltip', 'crumbsdoc', 'pagerdoc', 'progressdoc', 'calloutdoc', 'emptydoc', 'accdoc', 'topnav', 'sidenav', 'sheet', 'navshell', 'accordion-nav', 'shell', 'shell-rail', 'switcher', 'capsule', 'topbar', 'notifications', 'whatsnew', 'panel-states', 'drawer-states'];
let samples: Promise<string[]> | undefined;
const sample = (id: string) => () => (samples ??= import('./components.code.json').then((m) => m.default, (e) => { samples = undefined; throw e; })).then((c) => c[SAMPLED.indexOf(id)]);

export const INSTALL = "<link rel=\"stylesheet\" href=\"node_modules/@verseva/design/tokens.css\">\n<link rel=\"stylesheet\" href=\"node_modules/@verseva/design/components.css\">\n\n<!-- consumer surfaces boot light (law 9): -->\n<html data-theme=\"light\">\n\n<!-- enforce before you ship: -->\nnpx verseva-gate --tokens node_modules/@verseva/design/tokens.css src\n\n<!-- React, source-distribution (the shadcn model): components land in\n     YOUR project as source you own -->\nnpx verseva init\nnpx verseva add button field toast console-nav\nnpx verseva block add quote-tool";

/* One header icon per category. */
const ICON = {
  setup: tileIcon(<><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /></>),
  control: tileIcon(<><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>),
  surface: tileIcon(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 10h16" /></>),
  data: tileIcon(<><path d="M4 19h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></>),
  nav: tileIcon(<><path d="M4 6h16M4 12h10M4 18h6" /></>),
  console: tileIcon(<><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>),
};

/* Every attribute of every element, and the live state of every input, as rendered;
   put back on cleanup so a remount (route change, StrictMode) starts from the same DOM. */
function snapshot(root: HTMLElement, onCleanup: (fn: () => void) => void) {
  const attrs = [...root.querySelectorAll('*')].map((el) => [el, [...el.attributes].map((a) => [a.name, a.value] as const)] as const);
  const inputs = [...root.querySelectorAll('input')].map((i) => [i, i.checked, i.indeterminate, i.value] as const);
  onCleanup(() => {
    for (const [el, list] of attrs) {
      for (const a of [...el.attributes]) if (!list.some(([n]) => n === a.name)) el.removeAttribute(a.name);
      for (const [n, v] of list) if (el.getAttribute(n) !== v) el.setAttribute(n, v);
    }
    for (const [i, checked, indeterminate, value] of inputs) {
      i.checked = checked; i.indeterminate = indeterminate;
      /* .value on a checkbox writes its value attribute; only text-like inputs carry a typed value. */
      if (i.type !== 'checkbox' && i.type !== 'radio' && i.value !== value) i.value = value;
    }
  });
}

export const script: ChapterScript = (root, signal, onCleanup) => {
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, type: K, fn: (e: HTMLElementEventMap[K]) => void) =>
    el.addEventListener(type, fn as EventListener, { signal });
  /* Children the script replaces (inline menu values, the bulk count) come back on cleanup. */
  const keep = (el: Element) => { const kids = [...el.childNodes]; onCleanup(() => el.replaceChildren(...kids)); };
  snapshot(root, onCleanup);

  root.querySelectorAll('.tabbar').forEach((bar) => {
    on(bar, 'click', (e) => {
      const tab = (e.target as Element).closest('[role="tab"]');
      if (!tab) return;
      bar.querySelectorAll('[role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    });
  });
  root.querySelectorAll('.menu').forEach((menu) => {
    const trigger = menu.querySelector<HTMLElement>('[aria-haspopup]')!;
    const list = menu.querySelector<HTMLElement>('.menu-list')!;
    on(trigger, 'click', () => {
      const open = list.hidden;
      list.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    });
    on(window, 'pointerdown', (e) => {
      if (!menu.contains(e.target as Node)) { list.hidden = true; trigger.setAttribute('aria-expanded', 'false'); }
    });
  });

  root.querySelectorAll('.menu.inline').forEach((menu) => {
    const trigger = menu.querySelector<HTMLElement>('[aria-haspopup]')!;
    keep(trigger);
    menu.querySelectorAll('[role="menuitemradio"]').forEach((item) => {
      on(item, 'click', () => {
        if (item.getAttribute('aria-disabled') === 'true' || item.getAttribute('aria-busy') === 'true') return;
        menu.querySelectorAll('[role="menuitemradio"]').forEach((o) => o.setAttribute('aria-checked', String(o === item)));
        const value = item.cloneNode(true) as Element;
        value.querySelectorAll('.tick,.spinner').forEach((x) => x.remove());
        trigger.innerHTML = value.innerHTML;
        menu.querySelector<HTMLElement>('.menu-list')!.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      });
    });
  });

  root.querySelectorAll<HTMLInputElement>('.modal.erase input[data-phrase]').forEach((input) => {
    const go = input.closest('.modal')!.querySelector<HTMLButtonElement>('.btn-destructive')!;
    on(input, 'input', () => { go.disabled = input.value.trim() !== input.dataset.phrase; });
  });

  root.querySelectorAll<HTMLElement>('.bulk-demo').forEach((panel) => {
    const all = panel.querySelector<HTMLInputElement>('thead .pick input')!;
    const boxes = [...panel.querySelectorAll<HTMLInputElement>('tbody .pick input')];
    const bar = panel.querySelector<HTMLElement>('.bulkbar')!;
    const count = bar.querySelector('.count')!;
    keep(count);
    const sync = () => {
      const k = boxes.filter((b) => b.checked).length;
      boxes.forEach((b) => {
        const tr = b.closest('tr')!;
        if (b.checked) tr.setAttribute('aria-selected', 'true'); else tr.removeAttribute('aria-selected');
      });
      all.checked = k === boxes.length;
      all.indeterminate = k > 0 && k < boxes.length;
      bar.hidden = k === 0;
      count.textContent = `${k} selected`;
    };
    boxes.forEach((b) => on(b, 'change', sync));
    on(all, 'change', () => { boxes.forEach((b) => { b.checked = all.checked; }); sync(); });
    on(bar.querySelector('[aria-label="Clear selection"]')!, 'click', () => { boxes.forEach((b) => { b.checked = false; }); sync(); all.focus(); });
    on(panel, 'keydown', (e) => { if (e.key === 'Escape') { boxes.forEach((b) => { b.checked = false; }); sync(); } });
    sync();
  });

  root.querySelectorAll<HTMLElement>('.sgroup-head').forEach((head) => {
    on(head, 'click', () => {
      const group = head.closest<HTMLElement>('.sgroup')!;
      const nav = group.querySelector<HTMLElement>('.snav')!;
      if (nav.querySelector('a.active')) return;
      const open = group.dataset.open !== 'true';
      group.dataset.open = String(open);
      head.setAttribute('aria-expanded', String(open));
      nav.hidden = !open;
    });
  });
};

export function Page() {
  return (
    <NativeChapter slug="components" script={script}>
      <section className="hero">
        <h1>Components</h1>
        {/* Labels only (ruling 2026-11-04). */}
        <div className="chips">
          <a className="btn btn-secondary sm" href="/widgets">Widgets</a>
        </div>
      </section>
      <div className="docgrid">
        <SpecimenGrid className="doccol">
          <SpecimenTile id="install" name="Install" icon={ICON.setup} size="m" code={INSTALL}>
            <div className="demo">
              <span className="badge ok">npm i @verseva/design</span>
              <span className="badge neutral">or vendor the two css files</span>
            </div>
          </SpecimenTile>
          <SpecimenTile id="spacing" name="Spacing utilities" icon={ICON.setup} size="m" code={sample('spacing')}>
            <div className="demo">
              <div className="specimen">
                <div>
                  <div className="chiprow">
                    <button className="fchip" type="button" aria-pressed="true">All</button>
                    <button className="fchip" type="button" aria-pressed="false">Open</button>
                  </div>
                  <div className="lrows mt-4">
                    <div className="lrow">
                      <span className="avc">KW</span>
                      <span className="tx">
                        <b>The mt-4 above me is the seam</b>
                        <span className="metaline">chiprow to content, on the scale</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="button" name="Button" icon={ICON.control} size="m" meta="8 variants" code={sample('button')}>
            <div className="demo">
              <div className="specimen">
                <button className="btn btn-primary" type="button">Primary</button>
                {' '}
                <button className="btn btn-secondary" type="button">Secondary</button>
                {' '}
                <button className="btn btn-ghost" type="button">Ghost</button>
                {' '}
                <button className="btn btn-destructive" type="button">Delete</button>
                {' '}
                <button className="btn btn-primary sm" type="button">Small</button>
                {' '}
                <button className="btn btn-primary lg" type="button">Large</button>
                {' '}
                <button className="btn btn-primary" type="button" disabled>Disabled</button>
                {' '}
                <button className="btn btn-secondary" type="button"><span className="spinner"></span>Working</button>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="field" name="Field" icon={ICON.control} size="m" meta="2 states" code={sample('field')}>
            <div className="demo">
              <div className="specimen">
                <div className="field">
                  <label htmlFor="doc-client">Client</label>
                  {' '}
                  <input id="doc-client" placeholder="Acme Bottling" />
                  <div className="help">As it appears on the quote.</div>
                </div>
                <div className="field error">
                  <label htmlFor="doc-email">Work email</label>
                  {' '}
                  <input id="doc-email" defaultValue="not-an-email" />
                  <div className="help">Enter a work email first.</div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="switch" name="Checkbox + switch" icon={ICON.control} size="m" meta="2 variants" code={sample('switch')}>
            <div className="demo">
              <div className="specimen">
                <label className="sel"><input type="checkbox" defaultChecked />Include freight</label>
                {' '}
                <label className="sel switch-wrap"><input className="sw" type="checkbox" defaultChecked /><span className="switch"></span>Provenance on</label>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="permission-picking" name="Permission picking" icon={ICON.control} size="m" meta="2 states" code={sample('permission-picking')}>
            <div className="demo">
              <div className="specimen" style={{ maxWidth: "620px" }}>
                <div className="searchblock">
                  <div className="searchbox">
                    <input type="search" defaultValue="export" aria-label="Search permissions" />
                  </div>
                  <div className="chiprow">
                    <button className="fchip" type="button" aria-pressed="true">All areas</button>
                    <button className="fchip" type="button" aria-pressed="false">Blogs</button>
                    <button className="fchip" type="button" aria-pressed="false">Forms</button>
                    <button className="fchip" type="button" aria-pressed="false">Codes</button>
                  </div>
                </div>
                <div className="pickgroup">Forms</div>
                <label className="pickrow">
                  <input type="checkbox" className="chk" defaultChecked />
                  <span className="tx">
                    <b>Export entries</b>
                    <span className="key">forms.entries.export</span>
                    <span className="metaline">Line sheet requests</span>
                  </span>
                  <span className="tchip on">Export finished</span>
                </label>
                {' '}
                <label className="pickrow">
                  <input type="checkbox" className="chk" />
                  <span className="tx">
                    <b>Erase a contact</b>
                    <span className="key">forms.contacts.erase</span>
                  </span>
                  <span className="tchip">{"Admin "}<span className="cnt">2</span></span>
                </label>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="sel-two-line" name="Two-line choice" icon={ICON.control} size="m" meta="3 variants" code={sample('sel-two-line')}>
            <div className="demo">
              <div className="specimen">
                <fieldset>
                  <legend>Role</legend>
                  {' '}
                  <label className="sel two-line">
                    <input type="radio" name="spec-role" aria-describedby="spec-r1" />
                    <span className="tx">
                      <span>Admin</span>
                      <span className="metaline" id="spec-r1">Team, blogs, forms, media, codes</span>
                    </span>
                  </label>
                  {' '}
                  <label className="sel two-line">
                    <input type="radio" name="spec-role" defaultChecked aria-describedby="spec-r2" />
                    <span className="tx">
                      <span>Editor</span>
                      <span className="metaline" id="spec-r2">Blogs, media</span>
                    </span>
                  </label>
                  {' '}
                  <label className="sel two-line">
                    <input type="radio" name="spec-role" aria-describedby="spec-r3" />
                    <span className="tx">
                      <span>Writer</span>
                      <span className="metaline" id="spec-r3">Own drafts</span>
                    </span>
                  </label>
                </fieldset>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="card" name="Card" icon={ICON.surface} size="m" code={sample('card')}>
            <div className="demo">
              <div className="specimen">
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
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="glass" name="Glass panel" icon={ICON.surface} size="xl" meta="3 variants" code={sample('glass')}>
            <div className="demo">
              <div className="specimen" style={{ flex: "1 1 100%" }}>
                <section className="glass">
                  <div className="hd">
                    <h4>Requests</h4>
                    <span className="badge neutral">3</span>
                  </div>
                  <div className="lrows">
                    <a className="lrow" href="#glass">
                      <span className="avc">SR</span>
                      <span className="tx">
                        <b>WS-02248</b>
                        <span className="metaline">Wholesale accounts · Sofia Reyes · 14d</span>
                      </span>
                      <span className="badge ok"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2 5.2 2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"></path></svg>Qualified</span>
                    </a>
                    {' '}
                    <a className="lrow" href="#glass">
                      <span className="avc">BO</span>
                      <span className="tx">
                        <b>WS-02215</b>
                        <span className="metaline">Wholesale accounts · Ben Okafor · 6d</span>
                      </span>
                      <span className="badge neutral"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 7.5 7.5 2.5M4 2.5h3.5V6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path></svg>Contacted</span>
                    </a>
                    {' '}
                    <a className="lrow" href="#glass">
                      <span className="avc">JP</span>
                      <span className="tx">
                        <b>CP-02254</b>
                        <span className="metaline">Cafe partners · Unassigned · 18h</span>
                      </span>
                      <span className="badge warn"><svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"></circle></svg>New</span>
                    </a>
                  </div>
                </section>
              </div>
              <div className="specimen">
                <section className="glass">
                  <div className="hd">
                    <h4>Requests</h4>
                  </div>
                  <div className="lrows">
                    <div className="lrow">
                      <span className="avc"></span>
                      <div className="tx">
                        <div className="skel"></div>
                        <div className="skel mt-2"></div>
                      </div>
                    </div>
                    <div className="lrow">
                      <span className="avc"></span>
                      <div className="tx">
                        <div className="skel"></div>
                        <div className="skel mt-2"></div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              <div className="specimen">
                <section className="glass">
                  <div className="hd">
                    <h4>Requests</h4>
                    <span className="badge neutral">0</span>
                  </div>
                  <div className="empty">
                    <b>No requests yet</b>
                    <button className="btn btn-secondary sm" type="button">Share the form</button>
                  </div>
                </section>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="badge" name="Badge" icon={ICON.surface} size="s" meta="4 variants" code={sample('badge')}>
            <div className="demo">
              <div className="specimen">
                <span className="badge ok">Verified</span>
                {' '}
                <span className="badge warn">2 pending</span>
                {' '}
                <span className="badge err">1 failing</span>
                {' '}
                <span className="badge neutral">Draft</span>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="toast" name="Toast" icon={ICON.surface} size="s" meta="2 variants" code={sample('toast')}>
            <div className="demo">
              <div className="specimen">
                <div className="toast ok"><span className="dot"></span>Quote issued to Northline Foods.<button type="button">×</button></div>
                <div className="toast err"><span className="dot"></span>Blocked: rush ruling still open.<button type="button">×</button></div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="modal" name="Modal" icon={ICON.surface} size="m" code={sample('modal')}>
            <div className="demo">
              <div className="specimen">
                <div className="modal">
                  <div className="bd">
                    <h4>Issue quote 2081?</h4>
                    <p>Every line carries provenance. This sends it to the client.</p>
                  </div>
                  <div className="ft">
                    <button className="btn btn-ghost" type="button">Cancel</button>
                    <button className="btn btn-primary" type="button">Issue quote</button>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="erase" name="Confirm to erase" icon={ICON.surface} size="xl" meta="3 states" code={sample('erase')}>
            <div className="demo">
              <div className="specimen">
                <div className="modal erase" role="alertdialog" aria-labelledby="erase-t" aria-describedby="erase-d">
                  <div className="bd">
                    <h4 id="erase-t">Erase Marisol Vega?</h4>
                    <p id="erase-d">Removes the contact, 10 activity items and 2 requests. This cannot be undone.</p>
                    <div className="field">
                      <label htmlFor="erase-in">{"Type "}<span className="phrase">Marisol Vega</span>{" to confirm"}</label>
                      <input id="erase-in" data-phrase="Marisol Vega" autoComplete="off" spellCheck="false" />
                    </div>
                  </div>
                  <div className="ft">
                    <button className="btn btn-ghost" type="button">Cancel</button>
                    <button className="btn btn-destructive" type="button" disabled>Erase contact</button>
                  </div>
                </div>
              </div>
              <div className="specimen">
                <div className="modal erase" role="alertdialog" aria-label="Erase Marisol Vega, armed">
                  <div className="bd">
                    <h4>Erase Marisol Vega?</h4>
                    <p>Removes the contact, 10 activity items and 2 requests. This cannot be undone.</p>
                    <div className="field">
                      <label htmlFor="erase-in2">{"Type "}<span className="phrase">Marisol Vega</span>{" to confirm"}</label>
                      <input id="erase-in2" defaultValue="Marisol Vega" autoComplete="off" spellCheck="false" />
                    </div>
                  </div>
                  <div className="ft">
                    <button className="btn btn-ghost" type="button">Cancel</button>
                    <button className="btn btn-destructive" type="button">Erase contact</button>
                  </div>
                </div>
              </div>
              <div className="specimen">
                <div className="modal erase" role="alertdialog" aria-label="Erase Marisol Vega, failed">
                  <div className="bd">
                    <h4>Erase Marisol Vega?</h4>
                    <p>Removes the contact, 10 activity items and 2 requests. This cannot be undone.</p>
                    <div className="field">
                      <label htmlFor="erase-in3">{"Type "}<span className="phrase">Marisol Vega</span>{" to confirm"}</label>
                      <input id="erase-in3" defaultValue="Marisol Vega" autoComplete="off" spellCheck="false" />
                    </div>
                    <div className="callout err" role="alert">
                      <span><b>Not erased.</b>{" The connection dropped. Try again."}</span>
                    </div>
                  </div>
                  <div className="ft">
                    <button className="btn btn-ghost" type="button">Cancel</button>
                    <button className="btn btn-destructive" type="button">Erase contact</button>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="table" name="Table" icon={ICON.data} size="xl" code={sample('table')}>
            <div className="demo">
              {/* The 541px specimen scrolls in place at 375px, not the page. */}
              <div className="tscroll">
                <div className="specimen">
                  <table className="table" aria-label="Identity cell specimen">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <span className="ident">
                            <b>Avery Lane</b>
                            <small>avery@example.test</small>
                          </span>
                        </td>
                        <td>Admin</td>
                      </tr>
                      <tr>
                        <td>
                          <span className="ident">
                            <b>alexandria.konstantinopoulou@long-department.example.test</b>
                            <small>alexandria.konstantinopoulou@long-department.example.test</small>
                          </span>
                        </td>
                        <td>Editor</td>
                      </tr>
                    </tbody>
                  </table>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Quote</th>
                        <th>Client</th>
                        <th>Status</th>
                        <th className="num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Q-2081</td>
                        <td>Northline Foods</td>
                        <td>
                          <span className="badge ok">Verified</span>
                        </td>
                        <td className="num">48,220.00</td>
                      </tr>
                      <tr>
                        <td>Q-2080</td>
                        <td>Harbor Botanics</td>
                        <td>
                          <span className="badge warn">Pending</span>
                        </td>
                        <td className="num">12,940.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="table-pin" name="Pinned table header" icon={ICON.data} size="xl" code={sample('table-pin')}>
            <div className="demo">
              {/* min-width: 0 lets the .pin.box scroll the table at 375px, not the page. */}
              <div className="specimen" style={{ flex: "1 1 100%", minWidth: 0 }}>
                <div className="pin box" style={{ maxHeight: "240px" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Quote</th>
                        <th>Client</th>
                        <th>Status</th>
                        <th className="num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Q-2081</td>
                        <td>Northline Foods</td>
                        <td>
                          <span className="badge ok">Verified</span>
                        </td>
                        <td className="num">48,220.00</td>
                      </tr>
                      <tr>
                        <td>Q-2080</td>
                        <td>Harbor Botanics</td>
                        <td>
                          <span className="badge warn">Pending</span>
                        </td>
                        <td className="num">12,940.00</td>
                      </tr>
                      <tr>
                        <td>Q-2079</td>
                        <td>{"Cedar & Pine"}</td>
                        <td>
                          <span className="badge ok">Verified</span>
                        </td>
                        <td className="num">7,310.00</td>
                      </tr>
                      <tr>
                        <td>Q-2078</td>
                        <td>Ridgeway Labs</td>
                        <td>
                          <span className="badge warn">Pending</span>
                        </td>
                        <td className="num">22,105.00</td>
                      </tr>
                      <tr>
                        <td>Q-2077</td>
                        <td>Northline Foods</td>
                        <td>
                          <span className="badge ok">Verified</span>
                        </td>
                        <td className="num">3,980.00</td>
                      </tr>
                      <tr>
                        <td>Q-2076</td>
                        <td>Saltmarsh Co.</td>
                        <td>
                          <span className="badge ok">Verified</span>
                        </td>
                        <td className="num">15,600.00</td>
                      </tr>
                      <tr>
                        <td>Q-2075</td>
                        <td>Harbor Botanics</td>
                        <td>
                          <span className="badge warn">Pending</span>
                        </td>
                        <td className="num">9,450.00</td>
                      </tr>
                      <tr>
                        <td>Q-2074</td>
                        <td>Ridgeway Labs</td>
                        <td>
                          <span className="badge ok">Verified</span>
                        </td>
                        <td className="num">31,020.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="bulk" name="Bulk selection" icon={ICON.data} size="xl" code={sample('bulk')}>
            <div className="demo">
              {/* The 320px table scrolls in place at phone widths, not the page. */}
              <div className="tscroll" style={{ flex: "1 1 100%" }}>
                <div className="specimen" style={{ flex: "1 1 100%" }}>
                  <div className="glass bulk-demo">
                    <table className="table">
                      <thead>
                        <tr>
                          <th className="pick">
                            <label>
                              <input type="checkbox" aria-label="Select all" data-indeterminate="" />
                            </label>
                          </th>
                          <th>Quote</th>
                          <th className="client">Client</th>
                          <th>Status</th>
                          <th className="num">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr aria-selected="true">
                          <td className="pick">
                            <label>
                              <input type="checkbox" aria-label="Select Q-2081" defaultChecked />
                            </label>
                          </td>
                          <td>Q-2081</td>
                          <td className="client">Northline Foods</td>
                          <td>
                            <span className="badge ok">Verified</span>
                          </td>
                          <td className="num">48,220.00</td>
                        </tr>
                        <tr aria-selected="true">
                          <td className="pick">
                            <label>
                              <input type="checkbox" aria-label="Select Q-2080" defaultChecked />
                            </label>
                          </td>
                          <td>Q-2080</td>
                          <td className="client">Harbor Botanics</td>
                          <td>
                            <span className="badge warn">Pending</span>
                          </td>
                          <td className="num">12,940.00</td>
                        </tr>
                        <tr>
                          <td className="pick">
                            <label>
                              <input type="checkbox" aria-label="Select Q-2079" />
                            </label>
                          </td>
                          <td>Q-2079</td>
                          <td className="client">{"Cedar & Pine"}</td>
                          <td>
                            <span className="badge ok">Verified</span>
                          </td>
                          <td className="num">7,310.00</td>
                        </tr>
                        <tr>
                          <td className="pick">
                            <label>
                              <input type="checkbox" aria-label="Select Q-2078" />
                            </label>
                          </td>
                          <td>Q-2078</td>
                          <td className="client">Ridgeway Labs</td>
                          <td>
                            <span className="badge warn">Pending</span>
                          </td>
                          <td className="num">22,105.00</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="bulkbar" role="toolbar" aria-label="Bulk actions">
                      <span className="count" aria-live="polite">2 selected</span>
                      {' '}
                      <button className="btn btn-ghost sm" type="button">Assign</button>
                      {' '}
                      <button className="btn btn-ghost sm" type="button">Export</button>
                      {' '}
                      <button className="btn btn-destructive sm" type="button">Archive</button>
                      {' '}
                      <button className="btn btn-ghost sm icon" type="button" aria-label="Clear selection">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                          <path d="m6 6 12 12M18 6 6 18"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="specimen">
                <div className="bulkbar" role="toolbar" aria-label="Bulk actions, working" aria-busy="true">
                  <span className="count">2 selected</span>
                  {' '}
                  <button className="btn btn-ghost sm" type="button" disabled>Assign</button>
                  {' '}
                  <button className="btn btn-ghost sm" type="button"><span className="spinner" aria-hidden="true"></span>Exporting</button>
                  {' '}
                  <button className="btn btn-destructive sm" type="button" disabled>Archive</button>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="stat" name="Stat tile" icon={ICON.data} size="xl" meta="3 variants" code={sample('stat')}>
            <div className="demo">
              <div className="specimen">
                <div className="statrow">
                  <div className="stat">
                    <div className="num">18</div>
                    <div className="lbl">Open quotes</div>
                  </div>
                  <div className="stat">
                    <div className="num">4.4<i>ms</i></div>
                    <div className="lbl">p95 response</div>
                  </div>
                  <div className="stat">
                    <div className="num">97<i>%</i></div>
                    <div className="lbl">Provenance complete</div>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="chart" name="Chart card" icon={ICON.data} size="l" code={sample('chart')}>
            <div className="demo">
              <div className="specimen">
                <div className="chartcard">
                  <h4>Quotes closed</h4>
                  <div className="sub">Last 4 weeks</div>
                  <div className="bars">
                    <div className="bar">
                      <div className="fill" style={{ height: "40%" }}></div>
                      <span className="mlab">W1</span>
                    </div>
                    <div className="bar">
                      <div className="fill" style={{ height: "55%" }}></div>
                      <span className="mlab">W2</span>
                    </div>
                    <div className="bar">
                      <div className="fill" style={{ height: "78%" }}></div>
                      <span className="mlab">W3</span>
                    </div>
                    <div className="bar">
                      <div className="fill" style={{ height: "100%" }}></div>
                      <span className="mlab">W4</span>
                    </div>
                  </div>
                  <div className="takeaway">Throughput doubled after the provenance sweep.</div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="seg" name="Segmented control" icon={ICON.control} size="m" code={sample('seg')}>
            <div className="demo">
              <div className="specimen">
                <div className="seg">
                  <button type="button" aria-selected="true">Week</button>
                  <button type="button" aria-selected="false">Month</button>
                  <button type="button" aria-selected="false">Quarter</button>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="fchip" name="Filter chips" icon={ICON.control} size="m" meta="3 chips" code={sample('fchip')}>
            <div className="demo">
              <div className="specimen">
                <div className="chiprow">
                  <button className="fchip" type="button" aria-pressed="true">{"All "}<span className="cnt">6</span></button>
                  {' '}
                  <button className="fchip" type="button" aria-pressed="false">Dark</button>
                  {' '}
                  <button className="fchip" type="button" aria-pressed="false">Light</button>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="search" name="Search" icon={ICON.control} size="m" code={sample('search')}>
            <div className="demo">
              <div className="specimen">
                <div className="searchbox">
                  <input placeholder="Search quotes, clients" />
                  <kbd>/</kbd>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="rows" name="List rows + identity" icon={ICON.data} size="m" meta="2 variants" code={sample('rows')}>
            <div className="demo">
              <div className="specimen">
                <div className="lrows">
                  <div className="lrow">
                    <span className="avc">KW</span>
                    <span className="tx">
                      <b>Quote 2081 verified</b>
                      <span className="metaline">2 minutes ago</span>
                    </span>
                    <span className="val">48,220.00</span>
                  </div>
                  <div className="lrow">
                    <span className="avc">MR</span>
                    <span className="tx">
                      <b>Machine 12 recalibrated</b>
                      <span className="metaline">1 hour ago</span>
                    </span>
                    <span className="badge neutral">Logged</span>
                  </div>
                </div>
                <div className="avstack">
                  <span className="avc">KW</span>
                  <span className="avc">MR</span>
                  <span className="avc">+3</span>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="kv" name="Read-only field list" icon={ICON.data} size="xl" meta="2 variants" code={sample('kv')}>
            <div className="demo">
              <div className="specimen">
                <section className="glass">
                  <div className="hd">
                    <h4>Details</h4>
                    <button className="btn btn-ghost sm" type="button">Edit</button>
                  </div>
                  <dl className="kv">
                    <div>
                      <dt>Email</dt>
                      <dd>
                        <a href="mailto:marisol@driftwoodcafe.example.test">marisol@driftwoodcafe.example.test</a>
                      </dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>+1 555 0101</dd>
                    </div>
                    <div>
                      <dt>Company</dt>
                      <dd>Driftwood Cafe</dd>
                    </div>
                    <div>
                      <dt>Website</dt>
                      <dd>
                        <span className="unset">Not set</span>
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>
              <div className="specimen">
                <div className="card">
                  <dl className="kv">
                    <div>
                      <dt>Email</dt>
                      <dd>
                        <span className="skel"></span>
                      </dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>
                        <span className="skel"></span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="tline" name="Timeline" icon={ICON.data} size="xl" code={sample('tline')}>
            <div className="demo">
              <div className="specimen" style={{ flex: "1 1 100%" }}>
                <section className="glass">
                  <div className="hd">
                    <h4>Activity</h4>
                    <span className="badge neutral">4</span>
                  </div>
                  <ol className="lrows tline">
                    <li className="lrow new">
                      <span className="avc" title="Note">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M5 4h14v12l-4 4H5z"></path>
                          <path d="M9 9h6M9 13h4"></path>
                        </svg>
                      </span>
                      <span className="tx">
                        <b>Second location opens in March.</b>
                        <span className="metaline">{"Ben Okafor · "}<time dateTime="2026-10-20T09:18">Oct 20, 9:18 AM</time></span>
                      </span>
                    </li>
                    <li className="lrow">
                      <span className="avc" title="Request">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M4 13l3-8h10l3 8v6H4z"></path>
                          <path d="M4 13h5l1 2h4l1-2h5"></path>
                        </svg>
                      </span>
                      <span className="tx">
                        <b>WS-02203 submitted</b>
                        <span className="metaline">{"Wholesale accounts form · "}<time dateTime="2026-10-19T08:18">Oct 19, 8:18 AM</time></span>
                      </span>
                      <span className="badge warn"><svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"></circle></svg>New</span>
                    </li>
                    <li className="lrow">
                      <span className="avc" title="Stage">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M5 12h14M13 6l6 6-6 6"></path>
                        </svg>
                      </span>
                      <span className="tx">
                        <b>New to Qualified</b>
                        <span className="metaline">{"Sofia Reyes · WS-02248 · "}<time dateTime="2026-10-07T18:18">Oct 7, 6:18 PM</time></span>
                      </span>
                      <span className="badge ok"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2 5.2 2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"></path></svg>Qualified</span>
                    </li>
                    <li className="lrow">
                      <span className="avc" title="Note">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M5 4h14v12l-4 4H5z"></path>
                          <path d="M9 9h6M9 13h4"></path>
                        </svg>
                      </span>
                      <span className="tx">
                        <b>Tasting booked for Thursday at the roastery.</b>
                        <span className="metaline">{"Sofia Reyes · WS-02248 · "}<time dateTime="2026-10-15T09:18">Oct 15, 9:18 AM</time></span>
                      </span>
                    </li>
                  </ol>
                </section>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="skeleton" name="Skeleton" icon={ICON.surface} size="m" code={sample('skeleton')}>
            <div className="demo">
              <div className="specimen">
                <div className="lrows" aria-hidden="true">
                  <div className="lrow">
                    <span className="avc"></span>
                    <span className="tx skelstack">
                      <span className="skel w62"></span>
                      <span className="skel w38"></span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="select" name="Select + textarea" icon={ICON.control} size="m" meta="2 variants" code={sample('select')}>
            <div className="demo">
              <div className="specimen">
                <div className="field">
                  <label htmlFor="doc-machine">Machine</label>
                  {' '}
                  <select id="doc-machine">
                    <option>Line 12 · 500ml</option>
                    <option>Line 14 · 1L</option>
                  </select>
                  <div className="help">Assignment can change until the run starts.</div>
                </div>
                <div className="field">
                  <label htmlFor="doc-notes">Run notes</label>
                  {' '}
                  <textarea id="doc-notes" placeholder="Anything the operator should know" />
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="tabs" name="Tabs" icon={ICON.control} size="m" code={sample('tabs')}>
            <div className="demo">
              <div className="specimen">
                <div className="tabbar" role="tablist">
                  <button type="button" role="tab" aria-selected="true">Overview</button>
                  {' '}
                  <button type="button" role="tab" aria-selected="false">Provenance</button>
                  {' '}
                  <button type="button" role="tab" aria-selected="false">History</button>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="menu" name="Menu" icon={ICON.control} size="m" code={sample('menu')}>
            <div className="demo">
              <div className="specimen">
                <div className="menu">
                  <button type="button" className="btn btn-secondary sm" aria-haspopup="menu" aria-expanded="false">Actions</button>
                  <div className="menu-list" role="menu" hidden>
                    <button type="button" role="menuitem" className="menu-item">Duplicate quote</button>
                    {' '}
                    <button type="button" role="menuitem" className="menu-item">Export PDF</button>
                    <div className="menu-sep" role="separator"></div>
                    <button type="button" role="menuitem" className="menu-item danger">Delete draft</button>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="rowmenu" name="Row menu" icon={ICON.control} size="xl" meta="2 variants" code={sample('rowmenu')}>
            <div className="demo rowmenu-demo">
              <div className="specimen">
                <div className="menu inline">
                  <button type="button" className="btn btn-ghost sm" aria-haspopup="menu" aria-expanded="true">
                    <span className="badge warn"><svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"></circle></svg>New</span>
                  </button>
                  <div className="menu-list" role="menu" aria-label="Stage">
                    <button type="button" role="menuitemradio" aria-checked="true" className="menu-item">
                      <span className="badge warn"><svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"></circle></svg>New</span>
                      <svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                        <path d="m5 12 5 5 9-10"></path>
                      </svg>
                    </button>
                    {' '}
                    <button type="button" role="menuitemradio" aria-checked="false" className="menu-item">
                      <span className="badge neutral"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 7.5 7.5 2.5M4 2.5h3.5V6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path></svg>Contacted</span>
                      <svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                        <path d="m5 12 5 5 9-10"></path>
                      </svg>
                    </button>
                    {' '}
                    <button type="button" role="menuitemradio" aria-checked="false" className="menu-item">
                      <span className="badge ok"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2 5.2 2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"></path></svg>Qualified</span>
                      <svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                        <path d="m5 12 5 5 9-10"></path>
                      </svg>
                    </button>
                    <div className="menu-sep" role="separator"></div>
                    <button type="button" role="menuitemradio" aria-checked="false" className="menu-item">
                      <span className="badge ok"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2 5.2 2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"></path></svg>Won</span>
                      <svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                        <path d="m5 12 5 5 9-10"></path>
                      </svg>
                    </button>
                    {' '}
                    <button type="button" role="menuitemradio" aria-checked="false" className="menu-item" aria-disabled="true">
                      <span className="badge err"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="m3 3 4 4M7 3 3 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"></path></svg>Lost</span>
                      <svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                        <path d="m5 12 5 5 9-10"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="specimen">
                <div className="menu inline">
                  <button type="button" className="btn btn-ghost sm" aria-haspopup="menu" aria-expanded="false"><span className="avc">SR</span>Sofia Reyes</button>
                  <div className="menu-list" role="menu" aria-label="Owner" hidden>
                    <button type="button" role="menuitemradio" aria-checked="true" className="menu-item"><span className="avc">SR</span>Sofia Reyes<svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="m5 12 5 5 9-10"></path></svg></button>
                    {' '}
                    <button type="button" role="menuitemradio" aria-checked="false" className="menu-item"><span className="avc">BO</span>Ben Okafor<svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="m5 12 5 5 9-10"></path></svg></button>
                    {' '}
                    <button type="button" role="menuitemradio" aria-checked="false" className="menu-item" aria-busy="true"><span className="avc">HI</span>Hana Ito<span className="spinner" aria-hidden="true"></span></button>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="tooltip" name="Tooltip" icon={ICON.control} size="s" code={sample('tooltip')}>
            <div className="demo">
              <div className="specimen">
                <span className="tip">
                  <button className="btn btn-secondary sm" type="button">Provenance</button>
                  <span className="tipbox" role="tooltip">4 sources attached</span>
                </span>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="crumbsdoc" name="Breadcrumbs" icon={ICON.nav} size="s" code={sample('crumbsdoc')}>
            <div className="demo">
              <div className="specimen">
                <nav className="crumbs" aria-label="Breadcrumb">
                  <span className="sep">/</span>
                  {' '}
                  <span className="sep">/</span>
                  {' '}
                  <span aria-current="page">Quote 2081</span>
                </nav>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="pagerdoc" name="Pagination" icon={ICON.nav} size="m" code={sample('pagerdoc')}>
            <div className="demo">
              <div className="specimen">
                <nav className="pager" aria-label="Pagination">
                  <button type="button" disabled>‹</button>
                  {' '}
                  <button type="button" aria-current="page">1</button>
                  {' '}
                  <button type="button">2</button>
                  {' '}
                  <button type="button">3</button>
                  {' '}
                  <button type="button">›</button>
                </nav>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="progressdoc" name="Progress" icon={ICON.data} size="m" code={sample('progressdoc')}>
            <div className="demo">
              <div className="specimen">
                <div className="field">
                  <label htmlFor="doc-progress">Sourcing · 8 of 12 vendors confirmed</label>
                  <div className="progress" id="doc-progress" role="progressbar" aria-valuenow={67} aria-valuemin={0} aria-valuemax={100}>
                    <div className="fill" style={{ width: "67%" }}></div>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="calloutdoc" name="Callout" icon={ICON.surface} size="m" meta="2 variants" code={sample('calloutdoc')}>
            <div className="demo">
              <div className="specimen">
                <div className="callout"><b>Heads up.</b>{"\u00a0The rate card moved to v18; open quotes keep their issued rates."}</div>
                <div className="callout warn"><b>Rush window.</b>{"\u00a0This date is inside the 10-day floor and needs a ruling."}</div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="emptydoc" name="Empty state" icon={ICON.surface} size="m" code={sample('emptydoc')}>
            <div className="demo">
              <div className="specimen">
                <div className="empty">
                  <b>No quotes yet</b>
                  {' '}
                  <span>The first one takes about four minutes.</span>
                  {' '}
                  <button className="btn btn-primary" type="button">New quote</button>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="accdoc" name="Content accordion" icon={ICON.surface} size="m" code={sample('accdoc')}>
            <div className="demo">
              <div className="specimen">
                <div className="acc">
                  <details open>
                    <summary>Every batch, assayed</summary>
                    <div className="accbody">Stated dose vs measured dose, to two decimals, on every lot.</div>
                  </details>
                  <details>
                    <summary>Dosing</summary>
                    <div className="accbody">Consistency beats timing; the streak matters more than the clock.</div>
                  </details>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="topnav" name="Top navigation" icon={ICON.nav} size="xl" code={sample('topnav')}>
            <div className="demo">
              <div className="specimen">
                <div className="topnav">
                  <nav>
                    <a className="active" href="#overview">Overview</a>
                  </nav>
                  <button className="btn btn-primary sm" type="button">New quote</button>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="sidenav" name="Console navigation · flat" icon={ICON.nav} size="m" code={sample('sidenav')}>
            <div className="demo">
              <div className="specimen">
                <button type="button" className="switcher">
                  <span className="otile init" aria-hidden="true">AC</span>
                  <span className="oname">{"Acme Console "}<small>Owner</small></span>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m7 15 5 5 5-5M7 9l5-5 5 5"></path>
                  </svg>
                </button>
                <div>
                  <div className="grouplabel">Operate</div>
                  <nav className="snav" aria-label="Operate">
                    <a href="#overview" aria-current="page">{"Overview "}<span className="cnt">4</span></a>
                    {' '}
                    <a href="#quotes">{"Quotes "}<span className="cnt">18</span></a>
                    {' '}
                    <a href="#machines">{"Machines "}<span className="cnt">17</span></a>
                  </nav>
                </div>
                <div>
                  <div className="grouplabel">Manage</div>
                  <nav className="snav" aria-label="Manage">
                    <a href="#clients">Clients</a>
                    {' '}
                    <a href="#billing" aria-disabled="true">Billing</a>
                  </nav>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="sheet" name="Sheet" icon={ICON.surface} size="m" code={sample('sheet')}>
            <div className="demo">
              <div className="specimen">
                <div className="sheet">
                  <div className="grab"></div>
                  <div className="bd">
                    <h4>Issue quote 2081?</h4>
                    <p>Every line carries provenance.</p>
                  </div>
                  <div className="ft">
                    <button className="btn btn-secondary" type="button">Cancel</button>
                    <button className="btn btn-primary" type="button">Issue</button>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="navshell" name="Navshell" icon={ICON.nav} size="m" code={sample('navshell')}>
            <div className="demo">
              <div className="phoneframe">
                <div className="specimen">
                  <div className="navshell">
                    <div className="navmain">
                      <div className="tab on">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="12" cy="12" r="8"></circle>
                        </svg>
                        <span>Overview</span>
                      </div>
                      <div className="tab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="5" y="5" width="14" height="14" rx="3"></rect>
                        </svg>
                        <span>Quotes</span>
                      </div>
                      <div className="tab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M4 18 L10 10 L14 14 L20 6"></path>
                        </svg>
                        <span>Trends</span>
                      </div>
                      <div className="tab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="12" cy="9" r="4"></circle>
                          <path d="M5 20 C7 15, 17 15, 19 20"></path>
                        </svg>
                        <span>You</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="accordion-nav" name="Console navigation · accordion" icon={ICON.nav} size="m" code={sample('accordion-nav')}>
            <div className="demo">
              <div className="specimen">
                <div>
                  <div className="sgroup" data-open="true">
                    <button type="button" className="sgroup-head" aria-expanded="true" aria-controls="acc-operate">
                      <span className="grouplabel">Operate</span>
                      {' '}
                      <svg className="sgroup-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m6 9 6 6 6-6"></path>
                      </svg>
                    </button>
                    <nav className="snav" id="acc-operate" aria-label="Operate">
                      <a className="active" href="#overview">{"Overview "}<span className="cnt">4</span></a>
                      {' '}
                      <a href="#quotes">{"Quotes "}<span className="cnt">18</span></a>
                    </nav>
                  </div>
                  <div className="sgroup" data-open="true">
                    <button type="button" className="sgroup-head" aria-expanded="true" aria-controls="acc-manage">
                      <span className="grouplabel">Manage</span>
                      {' '}
                      <svg className="sgroup-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m6 9 6 6 6-6"></path>
                      </svg>
                    </button>
                    <nav className="snav" id="acc-manage" aria-label="Manage">
                    </nav>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="shell" name="Console shell" icon={ICON.console} size="xl" code={sample('shell')}>
            <div className="demo">
              <div className="specimen">
                <div className="shellframe">
                  <div className="cshell">
                    <a className="skip" href="#sh-main">Skip to content</a>
                    <div className="cside" id="sh-side" role="region" aria-label="Sidebar">
                      <button type="button" className="switcher" data-tip="Northwind Labs">
                        <span className="otile" aria-hidden="true">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10h-7a3 3 0 0 1-3-3z"></path>
                          </svg>
                        </span>
                        <span className="oname">{"Northwind Labs "}<small>Owner</small></span>
                        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m7 15 5 5 5-5M7 9l5-5 5 5"></path>
                        </svg>
                      </button>
                      <div className="cside-nav">
                        <div className="sgroup">
                          <div className="grouplabel">Operate</div>
                          <nav className="snav" aria-label="Operate">
                            <a href="#overview" aria-current="page">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
                                <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
                                <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
                                <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
                              </svg>
                              <span className="nl">Overview</span>
                            </a>
                            {' '}
                            <a href="#quotes">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path>
                                <path d="M14 3v5h5M9 13h6M9 17h4"></path>
                              </svg>
                              <span className="nl">Quotes</span>
                              <span className="cnt">18</span>
                            </a>
                            {' '}
                            <a href="#holds">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 21V4h11l-1.5 4L16 12H5"></path>
                              </svg>
                              <span className="nl">Holds</span>
                              <span className="cnt hot">2</span>
                            </a>
                          </nav>
                        </div>
                        <div className="sgroup">
                          <div className="grouplabel">Relations</div>
                          <nav className="snav" aria-label="Relations">
                            <a href="#clients">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="9" cy="8" r="3.5"></circle>
                                <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"></path>
                              </svg>
                              <span className="nl">Clients</span>
                            </a>
                            {' '}
                            <a href="#inbox">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 13h5l1.5 3h5L16 13h5"></path>
                                <path d="M5.5 5h13L21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z"></path>
                              </svg>
                              <span className="nl">Inbox</span>
                              <span className="cnt hot">3</span>
                            </a>
                          </nav>
                        </div>
                      </div>
                      <div className="cside-ft">
                        <button type="button" className="collapse-row" aria-controls="sh-side" aria-keyshortcuts="[" aria-label="Collapse sidebar" data-tip="Expand sidebar">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="16" rx="2.5"></rect>
                            <path d="M9 4v16"></path>
                          </svg>
                          <span>Collapse</span>
                          <kbd aria-hidden="true">[</kbd>
                        </button>
                        <div className="capsule">
                          <button type="button" className="acct" data-tip="Kai Webb">
                            <span className="avc" aria-hidden="true">KW</span>
                            <span className="who">
                              <b>Kai Webb</b>
                              {' '}
                              <small>kai@northwind.example</small>
                            </span>
                          </button>
                          {' '}
                          <button type="button" className="ibtn" aria-label="Settings" data-tip="Settings">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="3"></circle>
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                          </button>
                        </div>
                        <button type="button" className="platform" aria-label="Quarry v0.3.0, What's new" data-tip="Quarry v0.3.0">
                          <span className="pmark" aria-hidden="true">
                            <svg viewBox="0 0 22 14" aria-hidden="true">
                              <rect width="22" height="3.4" rx="1.7" fill="currentColor"></rect>
                              <rect x="3" y="5.3" width="16" height="3.4" rx="1.7" fill="currentColor"></rect>
                              <rect x="6" y="10.6" width="10" height="3.4" rx="1.7" fill="currentColor"></rect>
                            </svg>
                          </span>
                          <span className="v">v0.3.0</span>
                        </button>
                      </div>
                    </div>
                    <div className="cmain">
                      <header className="tbar">
                        <nav className="crumbs" aria-label="Breadcrumb">
                          <a href="#overview">Operate</a>
                          <span className="sep" aria-hidden="true">/</span>
                          <span aria-current="page">Overview</span>
                        </nav>
                        <div className="searchbox">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="11" cy="11" r="7"></circle>
                            <path d="m20 20-3.5-3.5"></path>
                          </svg>
                          <input type="search" aria-label="Search" placeholder="Search quotes, clients" />
                          <kbd aria-hidden="true">⌘K</kbd>
                        </div>
                        <div className="tbar-end">
                          <button type="button" className="ibtn" aria-label="Notifications, 3 unread">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                            </svg>
                            <span className="num" aria-hidden="true">3</span>
                          </button>
                          {' '}
                          <button type="button" className="ibtn" aria-label="Guides, What's new unread">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="9"></circle>
                              <path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7M12 17h.01"></path>
                            </svg>
                            <span className="dot" aria-hidden="true"></span>
                          </button>
                        </div>
                      </header>
                      <div className="cbody" id="sh-main" tabIndex={-1}>
                        <div className="statrow">
                          <div className="stat glass">
                            <div className="num">18</div>
                            <div className="lbl">Open quotes</div>
                          </div>
                          <div className="stat glass">
                            <div className="num">2</div>
                            <div className="lbl">Holds</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="railtip" aria-hidden="true" hidden></div>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="shell-rail" name="Console shell · rail" icon={ICON.console} size="xl" code={sample('shell-rail')}>
            <div className="demo">
              <div className="specimen">
                <div className="shellframe">
                  <div className="cshell">
                    <a className="skip" href="#shr-main">Skip to content</a>
                    <div className="cside" id="shr-side" role="region" aria-label="Sidebar" data-collapsed="">
                      <button type="button" className="switcher" data-tip="Northwind Labs">
                        <span className="otile" aria-hidden="true">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10h-7a3 3 0 0 1-3-3z"></path>
                          </svg>
                        </span>
                        <span className="oname">{"Northwind Labs "}<small>Owner</small></span>
                        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m7 15 5 5 5-5M7 9l5-5 5 5"></path>
                        </svg>
                      </button>
                      <div className="cside-nav">
                        <div className="sgroup">
                          <div className="grouplabel">Operate</div>
                          <nav className="snav" aria-label="Operate">
                            <a href="#overview" aria-current="page">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
                                <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
                                <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
                                <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
                              </svg>
                              <span className="nl">Overview</span>
                            </a>
                            {' '}
                            <a href="#quotes">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path>
                                <path d="M14 3v5h5M9 13h6M9 17h4"></path>
                              </svg>
                              <span className="nl">Quotes</span>
                              <span className="cnt">18</span>
                            </a>
                            {' '}
                            <a href="#holds">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 21V4h11l-1.5 4L16 12H5"></path>
                              </svg>
                              <span className="nl">Holds</span>
                              <span className="cnt hot">2</span>
                            </a>
                          </nav>
                        </div>
                        <div className="sgroup">
                          <div className="grouplabel">Relations</div>
                          <nav className="snav" aria-label="Relations">
                            <a href="#clients">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="9" cy="8" r="3.5"></circle>
                                <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"></path>
                              </svg>
                              <span className="nl">Clients</span>
                            </a>
                            {' '}
                            <a href="#inbox">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 13h5l1.5 3h5L16 13h5"></path>
                                <path d="M5.5 5h13L21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z"></path>
                              </svg>
                              <span className="nl">Inbox</span>
                              <span className="cnt hot">3</span>
                            </a>
                          </nav>
                        </div>
                      </div>
                      <div className="cside-ft">
                        <button type="button" className="collapse-row" aria-controls="shr-side" aria-keyshortcuts="[" aria-label="Expand sidebar" data-tip="Expand sidebar">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="16" rx="2.5"></rect>
                            <path d="M9 4v16"></path>
                          </svg>
                          <span>Collapse</span>
                          <kbd aria-hidden="true">[</kbd>
                        </button>
                        <div className="capsule">
                          <button type="button" className="acct" data-tip="Kai Webb">
                            <span className="avc" aria-hidden="true">KW</span>
                            <span className="who">
                              <b>Kai Webb</b>
                              {' '}
                              <small>kai@northwind.example</small>
                            </span>
                          </button>
                          {' '}
                          <button type="button" className="ibtn" aria-label="Settings" data-tip="Settings">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="3"></circle>
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                          </button>
                        </div>
                        <button type="button" className="platform" aria-label="Quarry v0.3.0, What's new" data-tip="Quarry v0.3.0">
                          <span className="pmark" aria-hidden="true">
                            <svg viewBox="0 0 22 14" aria-hidden="true">
                              <rect width="22" height="3.4" rx="1.7" fill="currentColor"></rect>
                              <rect x="3" y="5.3" width="16" height="3.4" rx="1.7" fill="currentColor"></rect>
                              <rect x="6" y="10.6" width="10" height="3.4" rx="1.7" fill="currentColor"></rect>
                            </svg>
                          </span>
                          <span className="v">v0.3.0</span>
                        </button>
                      </div>
                    </div>
                    <div className="cmain">
                      <header className="tbar">
                        <nav className="crumbs" aria-label="Breadcrumb">
                          <a href="#overview">Operate</a>
                          <span className="sep" aria-hidden="true">/</span>
                          <span aria-current="page">Overview</span>
                        </nav>
                        <div className="searchbox">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="11" cy="11" r="7"></circle>
                            <path d="m20 20-3.5-3.5"></path>
                          </svg>
                          <input type="search" aria-label="Search" placeholder="Search quotes, clients" />
                          <kbd aria-hidden="true">⌘K</kbd>
                        </div>
                        <div className="tbar-end">
                          <button type="button" className="ibtn" aria-label="Notifications, 3 unread">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                            </svg>
                            <span className="num" aria-hidden="true">3</span>
                          </button>
                          {' '}
                          <button type="button" className="ibtn" aria-label="Guides, What's new unread">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="9"></circle>
                              <path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7M12 17h.01"></path>
                            </svg>
                            <span className="dot" aria-hidden="true"></span>
                          </button>
                        </div>
                      </header>
                      <div className="cbody" id="shr-main" tabIndex={-1}>
                        <div className="statrow">
                          <div className="stat glass">
                            <div className="num">18</div>
                            <div className="lbl">Open quotes</div>
                          </div>
                          <div className="stat glass">
                            <div className="num">2</div>
                            <div className="lbl">Holds</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="railtip" aria-hidden="true" style={{ "--rt-x": "96px", "--rt-y": "138px" } as React.CSSProperties}>Quotes · 18</div>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="switcher" name="Org switcher" icon={ICON.console} size="l" code={sample('switcher')}>
            <div className="demo">
              <div className="specimen">
                <div className="shellframe side">
                  <div className="cside" role="region" aria-label="Sidebar">
                    <div className="menu">
                      <button type="button" className="switcher" aria-haspopup="menu" aria-expanded="true" aria-controls="sw-org" data-tip="Northwind Labs">
                        <span className="otile" aria-hidden="true">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10h-7a3 3 0 0 1-3-3z"></path>
                          </svg>
                        </span>
                        <span className="oname">{"Northwind Labs "}<small>Owner</small></span>
                        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m7 15 5 5 5-5M7 9l5-5 5 5"></path>
                        </svg>
                      </button>
                      <div className="menu-list full" id="sw-org" role="menu" aria-label="Organizations">
                        <button type="button" className="menu-item" role="menuitemradio" aria-checked="true" tabIndex={-1}><span className="otile" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10h-7a3 3 0 0 1-3-3z"></path></svg></span>Northwind Labs<svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"></path></svg></button>
                        {' '}
                        <button type="button" className="menu-item" role="menuitemradio" aria-checked="false" tabIndex={-1}><span className="otile init" aria-hidden="true">KC</span>{"Kestrel Co "}<span className="mhint">Admin</span><svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"></path></svg></button>
                        {' '}
                        <button type="button" className="menu-item" role="menuitemradio" aria-checked="false" tabIndex={-1}><span className="otile init" aria-hidden="true">OS</span>{"Orbit Studio "}<span className="mhint">Member</span><svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"></path></svg></button>
                        <div className="menu-sep" role="separator"></div>
                        <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"></path></svg>Organization settings</button>
                        {' '}
                        <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"></path></svg>Members and roles</button>
                        {' '}
                        <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"></rect><path d="M2.5 10h19M6.5 15h4"></path></svg>Billing</button>
                        {' '}
                        <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="4"></circle><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"></path></svg>Invite people</button>
                        <div className="menu-sep" role="separator"></div>
                        <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>New organization</button>
                      </div>
                    </div>
                    <div className="cside-nav">
                      <div className="sgroup">
                        <div className="grouplabel">Operate</div>
                        <nav className="snav" aria-label="Operate">
                          <a href="#overview" aria-current="page">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
                              <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
                              <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
                              <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
                            </svg>
                            <span className="nl">Overview</span>
                          </a>
                          {' '}
                          <a href="#quotes">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path>
                              <path d="M14 3v5h5M9 13h6M9 17h4"></path>
                            </svg>
                            <span className="nl">Quotes</span>
                            <span className="cnt">18</span>
                          </a>
                          {' '}
                          <a href="#holds">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 21V4h11l-1.5 4L16 12H5"></path>
                            </svg>
                            <span className="nl">Holds</span>
                            <span className="cnt hot">2</span>
                          </a>
                        </nav>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="capsule" name="Account capsule" icon={ICON.console} size="l" code={sample('capsule')}>
            <div className="demo">
              <div className="specimen">
                <div className="shellframe side">
                  <div className="cside" id="cap-side" role="region" aria-label="Sidebar">
                    <div className="cside-nav">
                      <div className="sgroup">
                        <div className="grouplabel">Operate</div>
                        <nav className="snav" aria-label="Operate">
                          <a href="#overview" aria-current="page">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
                              <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
                              <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
                              <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
                            </svg>
                            <span className="nl">Overview</span>
                          </a>
                          {' '}
                          <a href="#quotes">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path>
                              <path d="M14 3v5h5M9 13h6M9 17h4"></path>
                            </svg>
                            <span className="nl">Quotes</span>
                            <span className="cnt">18</span>
                          </a>
                          {' '}
                          <a href="#holds">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 21V4h11l-1.5 4L16 12H5"></path>
                            </svg>
                            <span className="nl">Holds</span>
                            <span className="cnt hot">2</span>
                          </a>
                        </nav>
                      </div>
                    </div>
                    <div className="cside-ft">
                      <button type="button" className="collapse-row" aria-controls="cap-side" aria-keyshortcuts="[" aria-label="Collapse sidebar" data-tip="Expand sidebar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="16" rx="2.5"></rect>
                          <path d="M9 4v16"></path>
                        </svg>
                        <span>Collapse</span>
                        <kbd aria-hidden="true">[</kbd>
                      </button>
                      <div className="menu">
                        <div className="capsule">
                          <button type="button" className="acct" aria-haspopup="menu" aria-expanded="true" aria-controls="cap-acct" data-tip="Kai Webb">
                            <span className="avc" aria-hidden="true">KW</span>
                            <span className="who">
                              <b>Kai Webb</b>
                              {' '}
                              <small>kai@northwind.example</small>
                            </span>
                          </button>
                          {' '}
                          <button type="button" className="ibtn" aria-label="Settings" data-tip="Settings">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="3"></circle>
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                          </button>
                        </div>
                        <div className="menu-list up full" id="cap-acct" role="menu" aria-label="Account">
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>Profile</button>
                          {' '}
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"></path></svg>Appearance</button>
                          <div className="menu-sep" role="separator"></div>
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"></path></svg>Sign out</button>
                        </div>
                      </div>
                      <button type="button" className="platform" aria-label="Quarry v0.3.0, What's new" data-tip="Quarry v0.3.0">
                        <span className="pmark" aria-hidden="true">
                          <svg viewBox="0 0 22 14" aria-hidden="true">
                            <rect width="22" height="3.4" rx="1.7" fill="currentColor"></rect>
                            <rect x="3" y="5.3" width="16" height="3.4" rx="1.7" fill="currentColor"></rect>
                            <rect x="6" y="10.6" width="10" height="3.4" rx="1.7" fill="currentColor"></rect>
                          </svg>
                        </span>
                        <span className="v">v0.3.0</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="topbar" name="Top bar" icon={ICON.console} size="xl" code={sample('topbar')}>
            <div className="demo">
              <div className="specimen">
                <div className="shellframe short">
                  <header className="tbar">
                    <nav className="crumbs" aria-label="Breadcrumb">
                      <a href="#overview">Operate</a>
                      <span className="sep" aria-hidden="true">/</span>
                      <span aria-current="page">Overview</span>
                    </nav>
                    <div className="searchbox">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7"></circle>
                        <path d="m20 20-3.5-3.5"></path>
                      </svg>
                      <input type="search" aria-label="Search" placeholder="Search quotes, clients" />
                      <kbd aria-hidden="true">⌘K</kbd>
                    </div>
                    <div className="tbar-end">
                      <div className="menu end">
                        <button type="button" className="ibtn" aria-label="Notifications, 3 unread" aria-haspopup="dialog" aria-expanded="false" aria-controls="tb-notif">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                          </svg>
                          <span className="num" aria-hidden="true">3</span>
                        </button>
                        <div className="menu-list panel" id="tb-notif" role="dialog" aria-labelledby="tb-notif-title" tabIndex={-1} hidden>
                          <div className="panel-hd">
                            <h4 id="tb-notif-title">Notifications</h4>
                            <button type="button">Mark all read</button>
                          </div>
                          <ul className="notifs">
                            <li>
                              <button type="button" className="notif unread">
                                <span className="avc" aria-hidden="true">MR</span>
                                <span className="tx"><b>Q-2081</b>{" verified by M. Reyes "}<span className="metaline"><time dateTime="PT2M">2 min ago</time></span></span>
                                {' '}
                                <span className="sr-only">Unread</span>
                                <span className="udot" aria-hidden="true"></span>
                              </button>
                            </li>
                            <li>
                              <button type="button" className="notif unread">
                                <span className="avc" aria-hidden="true">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M5 21V4h11l-1.5 4L16 12H5"></path>
                                  </svg>
                                </span>
                                <span className="tx">{"Machine "}<b>M-14</b>{" placed on hold "}<span className="metaline"><time dateTime="PT1H">1 hour ago</time></span></span>
                                {' '}
                                <span className="sr-only">Unread</span>
                                <span className="udot" aria-hidden="true"></span>
                              </button>
                            </li>
                            <li>
                              <button type="button" className="notif unread">
                                <span className="avc" aria-hidden="true">HB</span>
                                <span className="tx">{"Harbor Botanics replied to "}<b>Q-2080</b>{" "}<span className="metaline"><time dateTime="PT3H">3 hours ago</time></span></span>
                                {' '}
                                <span className="sr-only">Unread</span>
                                <span className="udot" aria-hidden="true"></span>
                              </button>
                            </li>
                            <li>
                              <button type="button" className="notif">
                                <span className="avc" aria-hidden="true">KC</span>
                                <span className="tx">{"You were added to Kestrel Co "}<span className="metaline"><time dateTime="P1D">Yesterday</time></span></span>
                              </button>
                            </li>
                          </ul>
                          <button type="button" className="panel-ft">View all</button>
                        </div>
                      </div>
                      <div className="menu end">
                        <button type="button" className="ibtn" aria-label="Guides, What's new unread" aria-haspopup="menu" aria-expanded="false" aria-controls="tb-guides">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9"></circle>
                            <path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7M12 17h.01"></path>
                          </svg>
                          <span className="dot" aria-hidden="true"></span>
                        </button>
                        <div className="menu-list" id="tb-guides" role="menu" aria-label="Guides" hidden>
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"></path></svg>{"What's new "}<span className="mhint"><span className="ver">v0.3.0</span><span className="newdot" aria-hidden="true"></span>{" "}<span className="sr-only">Unread</span></span></button>
                          <div className="menu-sep" role="separator"></div>
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5a2.5 2.5 0 0 0 0 5H20"></path></svg>Guides</button>
                          {' '}
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2.5"></rect><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"></path></svg>{"Keyboard shortcuts "}<span className="mhint"><kbd>?</kbd></span></button>
                          {' '}
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path></svg>Documentation</button>
                          {' '}
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path></svg>Contact support</button>
                        </div>
                      </div>
                    </div>
                  </header>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="notifications" name="Notifications" icon={ICON.console} size="xl" code={sample('notifications')}>
            <div className="demo">
              <div className="specimen">
                <div className="shellframe short tall">
                  <header className="tbar">
                    <nav className="crumbs" aria-label="Breadcrumb">
                      <a href="#overview">Operate</a>
                      <span className="sep" aria-hidden="true">/</span>
                      <span aria-current="page">Overview</span>
                    </nav>
                    <div className="searchbox">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7"></circle>
                        <path d="m20 20-3.5-3.5"></path>
                      </svg>
                      <input type="search" aria-label="Search" placeholder="Search quotes, clients" />
                      <kbd aria-hidden="true">⌘K</kbd>
                    </div>
                    <div className="tbar-end">
                      <div className="menu end">
                        <button type="button" className="ibtn" aria-label="Notifications, 3 unread" aria-haspopup="dialog" aria-expanded="true" aria-controls="nt-notif">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                          </svg>
                          <span className="num" aria-hidden="true">3</span>
                        </button>
                        <div className="menu-list panel" id="nt-notif" role="dialog" aria-labelledby="nt-notif-title" tabIndex={-1}>
                          <div className="panel-hd">
                            <h4 id="nt-notif-title">Notifications</h4>
                            <button type="button">Mark all read</button>
                          </div>
                          <ul className="notifs">
                            <li>
                              <button type="button" className="notif unread">
                                <span className="avc" aria-hidden="true">MR</span>
                                <span className="tx"><b>Q-2081</b>{" verified by M. Reyes "}<span className="metaline"><time dateTime="PT2M">2 min ago</time></span></span>
                                {' '}
                                <span className="sr-only">Unread</span>
                                <span className="udot" aria-hidden="true"></span>
                              </button>
                            </li>
                            <li>
                              <button type="button" className="notif unread">
                                <span className="avc" aria-hidden="true">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M5 21V4h11l-1.5 4L16 12H5"></path>
                                  </svg>
                                </span>
                                <span className="tx">{"Machine "}<b>M-14</b>{" placed on hold "}<span className="metaline"><time dateTime="PT1H">1 hour ago</time></span></span>
                                {' '}
                                <span className="sr-only">Unread</span>
                                <span className="udot" aria-hidden="true"></span>
                              </button>
                            </li>
                            <li>
                              <button type="button" className="notif unread">
                                <span className="avc" aria-hidden="true">HB</span>
                                <span className="tx">{"Harbor Botanics replied to "}<b>Q-2080</b>{" "}<span className="metaline"><time dateTime="PT3H">3 hours ago</time></span></span>
                                {' '}
                                <span className="sr-only">Unread</span>
                                <span className="udot" aria-hidden="true"></span>
                              </button>
                            </li>
                            <li>
                              <button type="button" className="notif">
                                <span className="avc" aria-hidden="true">KC</span>
                                <span className="tx">{"You were added to Kestrel Co "}<span className="metaline"><time dateTime="P1D">Yesterday</time></span></span>
                              </button>
                            </li>
                          </ul>
                          <button type="button" className="panel-ft">View all</button>
                        </div>
                      </div>
                      <div className="menu end">
                        <button type="button" className="ibtn" aria-label="Guides, What's new unread" aria-haspopup="menu" aria-expanded="false" aria-controls="nt-guides">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9"></circle>
                            <path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7M12 17h.01"></path>
                          </svg>
                          <span className="dot" aria-hidden="true"></span>
                        </button>
                        <div className="menu-list" id="nt-guides" role="menu" aria-label="Guides" hidden>
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"></path></svg>{"What's new "}<span className="mhint"><span className="ver">v0.3.0</span><span className="newdot" aria-hidden="true"></span>{" "}<span className="sr-only">Unread</span></span></button>
                          <div className="menu-sep" role="separator"></div>
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5a2.5 2.5 0 0 0 0 5H20"></path></svg>Guides</button>
                          {' '}
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2.5"></rect><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"></path></svg>{"Keyboard shortcuts "}<span className="mhint"><kbd>?</kbd></span></button>
                          {' '}
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path></svg>Documentation</button>
                          {' '}
                          <button type="button" className="menu-item" role="menuitem" tabIndex={-1}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path></svg>Contact support</button>
                        </div>
                      </div>
                    </div>
                  </header>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="whatsnew" name="What's new" icon={ICON.console} size="xl" code={sample('whatsnew')}>
            <div className="demo">
              <div className="specimen">
                <div inert className="shellframe">
                  <div className="scrim"></div>
                  <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="wn-spec-title">
                    <div className="drawer-hd">
                      <h4 id="wn-spec-title">What's new</h4>
                      <span className="vchip">v0.3.0</span>
                      <button type="button" className="ibtn" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M6 6l12 12M18 6 6 18"></path>
                        </svg>
                      </button>
                    </div>
                    <div className="drawer-bd" tabIndex={0} role="region" aria-label="Release notes">
                      <section className="rel" aria-label="v0.3.0">
                        <div className="relhead">
                          <h5>v0.3.0</h5>
                          <time dateTime="2026-10-23">Oct 23, 2026</time>
                        </div>
                        <ul className="chgs">
                          <li className="chg">
                            <span className="k">
                              <span className="badge bloom">New</span>
                            </span>
                            <span>Machine holds with a reason</span>
                          </li>
                          <li className="chg">
                            <span className="k">
                              <span className="badge bloom">New</span>
                            </span>
                            <span>Quote history on every client</span>
                          </li>
                          <li className="chg">
                            <span className="k">
                              <span className="badge bloom">New</span>
                            </span>
                            <span>Weekly summary email</span>
                          </li>
                          <li className="chg">
                            <span className="k">
                              <span className="badge neutral">Improved</span>
                            </span>
                            <span>List headers stay pinned while scrolling</span>
                          </li>
                          <li className="chg">
                            <span className="k">
                              <span className="badge neutral">Improved</span>
                            </span>
                            <span>Sidebar collapses to a rail</span>
                          </li>
                          <li className="chg">
                            <span className="k">
                              <span className="badge ok">Fixed</span>
                            </span>
                            <span>Duplicate contacts on client pages</span>
                          </li>
                        </ul>
                      </section>
                      <section className="rel seen" aria-label="v0.2.0">
                        <div className="relhead">
                          <h5>v0.2.0</h5>
                          <time dateTime="2026-09-30">Sep 30, 2026</time>
                        </div>
                        <ul className="chgs">
                          <li className="chg">
                            <span className="k">
                              <span className="badge neutral">New</span>
                            </span>
                            <span>Client request portal</span>
                          </li>
                          <li className="chg">
                            <span className="k">
                              <span className="badge neutral">New</span>
                            </span>
                            <span>Quote desk</span>
                          </li>
                          <li className="chg">
                            <span className="k">
                              <span className="badge neutral">Fixed</span>
                            </span>
                            <span>Rounding on quote totals</span>
                          </li>
                        </ul>
                      </section>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="panel-states" name="Notification states" icon={ICON.console} size="xl" meta="3 states" code={sample('panel-states')}>
            <div className="demo">
              <div className="specimen">
                <div className="shellframe states">
                  <div className="menu">
                    <button type="button" className="ibtn" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="true" aria-controls="ps-load">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                      </svg>
                    </button>
                    <div className="menu-list panel" id="ps-load" role="dialog" aria-labelledby="ps-load-title" tabIndex={-1}>
                      <div className="panel-hd">
                        <h4 id="ps-load-title">Notifications</h4>
                        <button type="button" disabled>Mark all read</button>
                      </div>
                      <div className="notifs" aria-busy="true">
                        <span className="sr-only">Loading</span>
                        <div className="notif" aria-hidden="true">
                          <span className="skel"></span>
                        </div>
                        <div className="notif" aria-hidden="true">
                          <span className="skel"></span>
                        </div>
                        <div className="notif" aria-hidden="true">
                          <span className="skel"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="specimen">
                <div className="shellframe states">
                  <div className="menu">
                    <button type="button" className="ibtn" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="true" aria-controls="ps-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                      </svg>
                    </button>
                    <div className="menu-list panel" id="ps-empty" role="dialog" aria-labelledby="ps-empty-title" tabIndex={-1}>
                      <div className="panel-hd">
                        <h4 id="ps-empty-title">Notifications</h4>
                        <button type="button" disabled>Mark all read</button>
                      </div>
                      <div className="panel-empty">No notifications</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="specimen">
                <div className="shellframe states">
                  <div className="menu">
                    <button type="button" className="ibtn" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="true" aria-controls="ps-error">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                      </svg>
                    </button>
                    <div className="menu-list panel" id="ps-error" role="dialog" aria-labelledby="ps-error-title" tabIndex={-1}>
                      <div className="panel-hd">
                        <h4 id="ps-error-title">Notifications</h4>
                        <button type="button" disabled>Mark all read</button>
                      </div>
                      <div className="panel-empty">
                        <span>Notifications did not load</span>
                        <button type="button" className="btn btn-secondary sm">Try again</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
          <SpecimenTile id="drawer-states" name="What's new states" icon={ICON.console} size="xl" meta="3 states" code={sample('drawer-states')}>
            <div className="demo">
              <div className="specimen">
                <div inert className="shellframe states">
                  <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="ds-load-title">
                    <div className="drawer-hd">
                      <h4 id="ds-load-title">What's new</h4>
                      <span className="vchip">v0.3.0</span>
                      <button type="button" className="ibtn" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M6 6l12 12M18 6 6 18"></path>
                        </svg>
                      </button>
                    </div>
                    <div className="drawer-bd" tabIndex={0} role="region" aria-label="Release notes">
                      <div className="rel" aria-busy="true">
                        <span className="sr-only">Loading</span>
                        <div className="chg" aria-hidden="true">
                          <span className="skel"></span>
                        </div>
                        <div className="chg" aria-hidden="true">
                          <span className="skel"></span>
                        </div>
                        <div className="chg" aria-hidden="true">
                          <span className="skel"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="specimen">
                <div inert className="shellframe states">
                  <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="ds-empty-title">
                    <div className="drawer-hd">
                      <h4 id="ds-empty-title">What's new</h4>
                      <span className="vchip">v0.3.0</span>
                      <button type="button" className="ibtn" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M6 6l12 12M18 6 6 18"></path>
                        </svg>
                      </button>
                    </div>
                    <div className="drawer-bd" tabIndex={0} role="region" aria-label="Release notes">
                      <div className="empty">No release notes</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="specimen">
                <div inert className="shellframe states">
                  <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="ds-error-title">
                    <div className="drawer-hd">
                      <h4 id="ds-error-title">What's new</h4>
                      <span className="vchip">v0.3.0</span>
                      <button type="button" className="ibtn" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M6 6l12 12M18 6 6 18"></path>
                        </svg>
                      </button>
                    </div>
                    <div className="drawer-bd" tabIndex={0} role="region" aria-label="Release notes">
                      <div className="empty">
                        <span>Release notes did not load</span>
                        <button type="button" className="btn btn-secondary sm">Try again</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SpecimenTile>
        </SpecimenGrid>
      </div>
      <footer className="site">
        <span>VERSEVA · open source · MIT</span>
        {' '}
        <span className="badge-line">Built on VERSEVA Design</span>
      </footer>
    </NativeChapter>
  );
}
