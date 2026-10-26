// Console shell recipes (1.3.0): selectors present, tokens only, rail keeps every name,
// contrast on the glass sidebar, reduced motion, deprecation. Reads files only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const RAW = read('components.css');
const TOKENS_RAW = read('tokens.css');
const THEMES = ['cobalt', 'forest', 'slate', 'violet'];
const SECTION_HEAD = "/* ---- Console shell (1.3.0): glass sidebar, rail, top bar, What's new ---- */";
const NEXT_HEAD = '/* ---- Stat tile / KPI ---- */';
const LOCAL_VARS = ['accent-fill', 'accent-fill-hover', 'attn-scroll', 'd', 'dc-angle', 'mx', 'my', 'sticky-bottom', 'sticky-top', 'rt-x', 'rt-y'];

// ---- CSS reading ----
function splitSelectors(prelude) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of prelude) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

function parseRules(src) {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  (function walk(text, media) {
    let i = 0;
    let start = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '{') {
        const prelude = text.slice(start, i).trim();
        let depth = 1;
        let j = i + 1;
        while (j < text.length && depth > 0) {
          if (text[j] === '{') depth++;
          else if (text[j] === '}') depth--;
          j++;
        }
        const body = text.slice(i + 1, j - 1);
        if (/^@(media|supports)\b/.test(prelude)) walk(body, prelude);
        else if (/^@keyframes\b/.test(prelude)) out.push({ media, selectors: [prelude.replace(/\s+/g, ' ')], body });
        else out.push({ media, selectors: splitSelectors(prelude), body });
        i = j;
        start = j;
      } else if (ch === '}') {
        i++;
        start = i;
      } else i++;
    }
  })(css, null);
  return out;
}

const RULES = parseRules(RAW);
const SELECTORS = new Set(RULES.flatMap((r) => r.selectors));
const bodyOf = (sel, media = null) => RULES.filter((r) => r.media === media && r.selectors.includes(sel)).map((r) => r.body).join(';');
const missing = (list) => list.filter((s) => !SELECTORS.has(s));
const section = () => {
  const a = RAW.indexOf(SECTION_HEAD);
  const b = RAW.indexOf(NEXT_HEAD);
  assert.ok(a > -1, 'console shell section header missing');
  assert.ok(b > a, 'console shell section must sit before the stat tile section');
  return RAW.slice(a, b);
};

// ---- token reading + WCAG math ----
function blocks(src) {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    out[sel] = { ...(out[sel] ?? {}) };
    for (const p of m[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[sel][p[1]] = p[2].trim();
  }
  return out;
}

function themeProps(mode, brand) {
  const base = blocks(TOKENS_RAW);
  let props = { ...base[':root'] };
  if (mode === 'light') props = { ...props, ...base['[data-theme="light"]'] };
  if (brand) {
    const b = blocks(read(`themes/${brand}.css`));
    props = { ...props, ...b[`[data-brand="${brand}"]`] };
    if (mode === 'light') props = { ...props, ...b[`[data-brand="${brand}"][data-theme="light"]`] };
  }
  return props;
}

function color(v) {
  const s = v.trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return { rgb: [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)), a: 1 };
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`unparsed color: ${v}`);
}

const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const WHITE = [255, 255, 255];

function scene(mode, brand) {
  const p = themeProps(mode, brand);
  const solid = (name) => color(p[name]).rgb;
  const bg = solid('bg');
  const fill = color(p['glass-fill-3']);
  const glass = over(fill.rgb, fill.a, bg);
  const catchLight = +p['surface-body'].match(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/)[1];
  const bloomCenter = +p['accent-bloom'].match(/color-mix\(in srgb,\s*var\(--accent\)\s*([\d.]+)%/)[1] / 100;
  return {
    bg, glass, glassTop: over(WHITE, catchLight, glass), bloomCenter,
    surface: solid('surface'), surface2: solid('surface-2'), accent: solid('accent'),
    text1: solid('text-1'), text2: solid('text-2'), text3: solid('text-3'),
  };
}

const MODES = ['dark', 'light'];
const EVERY_THEME = [null, ...THEMES];
function eachScene(fn) {
  const fails = [];
  for (const brand of EVERY_THEME) for (const mode of MODES) {
    const r = fn(scene(mode, brand));
    if (r < 4.5) fails.push(`${brand ?? 'base'} ${mode}: ${r.toFixed(2)}`);
  }
  return fails;
}

// ---- placement ----
test('placement: one console shell section between console navigation and the stat tile', () => {
  section();
  assert.equal(RAW.split(SECTION_HEAD).length, 2, 'exactly one console shell section');
  assert.ok(RAW.indexOf('.snav .cnt{') < RAW.indexOf(SECTION_HEAD), 'section must follow the .snav .cnt rule');
});

// ---- selectors present, part by part ----
test('layout and nav rows: selectors present', () => {
  assert.deepEqual(missing(['.cshell', '.cshell .skip', '.cshell .skip:focus', '.cside', '.cside-nav', '.cside-nav>.sgroup:first-child', '.cside-ft', '.cside .menu', '.cside .menu-list.full', '.menu-list.up', '.cmain', '.cbody', '.snav .nl', '.snav .ni', '.snav .cnt.hot', '.cside .snav a svg', '.cside .snav a:not(.active):not([aria-current="page"]):hover']), []);
  assert.ok(bodyOf('.cside', '@media (max-width:899.98px)').includes('display:none'), 'sidebar hides under 900px');
  const m900 = '@media (max-width:899.98px)';
  assert.match(bodyOf('.tbar .searchbox', m900), /min-width:0/, 'search shrinks under 900px');
  assert.match(bodyOf('.tbar .searchbox kbd', m900), /display:none/, 'search chord hides under 900px');
  assert.match(bodyOf('.tbar .menu .menu-list.panel', m900), /position:fixed/, 'notifications panel pins to the viewport under 900px');
  assert.match(bodyOf('header.tbar', m900), /padding:0 var\(--s-4\)/, 'top bar padding tightens under 900px');
  assert.match(bodyOf('.tbar .crumbs', '@media (max-width:599.98px)'), /display:none/, 'crumbs hide under 600px');
  assert.match(bodyOf('.cside-nav'), /margin:calc\(var\(--s-1\) \* -1\);padding:var\(--s-1\);scroll-padding:var\(--s-1\)/, 'focus rings never clip at the nav edges');
  assert.match(bodyOf('.cside .menu-list.full'), /max-height:min\(440px,calc\(100dvh - 140px\)\);overflow-y:auto/, 'long org menus scroll');
});

test('org switcher and shell menus: selectors present', () => {
  assert.deepEqual(missing(['.switcher', '.switcher:hover', '.switcher[aria-expanded="true"]', '.switcher:focus-visible', '.switcher:active', '.switcher:disabled', '.switcher .chev', '.otile', '.otile svg', '.otile img', '.otile.init', '.oname', '.oname small', '.switcher:hover .oname small', '.switcher[aria-expanded="true"] .oname small', '.oword', '.oword svg', '.oword img', '.switcher.word .otile', '.switcher.word .oname', ':is(.cside,.tbar) .menu-item>svg:not(.tick)', '.menu-item .otile', '.menu-item .otile svg', '.menu-item .otile img', '.menu-item .otile.init', '.menu-item .mhint', '.menu-item .mhint+.tick', '.mhint .ver', '.mhint .newdot', '.collapse-row kbd', '.mhint kbd']), []);
});

test('foot: collapse row, capsule, icon button, platform: selectors present', () => {
  assert.deepEqual(missing(['.collapse-row', '.collapse-row:hover', '.collapse-row:focus-visible', '.collapse-row:active', '.collapse-row svg', '.capsule', '.acct', 'button.acct:hover', '.acct[aria-expanded="true"]', '.acct:focus-visible', 'button.acct:active', 'div.acct', '.acct .avc', '.avc img', '.acct .who', '.acct .who b', '.acct .who small', 'button.acct:hover .who small', '.acct[aria-expanded="true"] .who small', '.ibtn', '.ibtn:hover', '.ibtn[aria-expanded="true"]', '.capsule .ibtn:hover', '.capsule .ibtn[aria-expanded="true"]', '.ibtn:focus-visible', '.ibtn:active', '.ibtn:disabled', '.ibtn[aria-disabled="true"]', '.ibtn svg', '.ibtn .num', '.ibtn .dot', '.platform', '.platform:hover', '.platform:focus-visible', '.platform:active', '.platform .pmark', '.platform .pmark svg', '.platform .pmark img', '.platform .v', '.platform .pmark .on-light', '[data-theme="light"] .platform .pmark .on-dark', '[data-theme="light"] .platform .pmark .on-light']), []);
  const coarse = '@media (pointer:coarse)';
  assert.match(bodyOf('.ibtn', coarse), /width:44px;height:44px/, 'icon buttons reach 44px on touch');
  for (const s of ['.cside .snav a', '.collapse-row', '.acct', '.platform']) assert.match(bodyOf(s, coarse), /min-height:44px/, `${s} reaches 44px on touch`);
});

test('top bar and notifications: selectors present', () => {
  assert.deepEqual(missing(['.tbar', '.tbar .crumbs', '.tbar .searchbox', '.tbar-end', '.tbar .searchbox+.tbar-end', '.menu-list.panel', '.panel-hd', '.panel-hd h4', '.panel-hd button', '.panel-hd button:hover', '.panel-hd button:focus-visible', '.panel-hd button:disabled', '.notifs', '.notifs:focus-visible', '.notif', 'button.notif', 'a.notif', '.notif.unread', 'button.notif:hover', 'a.notif:hover', '.notif:focus-visible', '.notif .avc', '.notif .avc svg', '.notif .tx', '.notif .tx b', '.notif .metaline', '.notif.unread .metaline', '.notif .udot', '.panel-empty', '.panel-ft', '.panel-ft:hover', '.panel-ft:focus-visible']), []);
  assert.match(bodyOf('.notif .metaline'), /display:block/, 'the time sits on its own line');
  assert.match(bodyOf('.panel-empty'), /display:grid/, 'empty, loading and error states stack their retry');
});

test("What's new drawer: selectors present", () => {
  assert.deepEqual(missing(['.scrim', '.drawer', '.scrim[hidden]', '.drawer[hidden]', '@keyframes dc-sheet', '.drawer-hd', '.drawer-hd h4', '.vchip', '.drawer-bd', '.drawer-bd:focus-visible', '.drawer .rel', '.drawer .rel+.rel', '.drawer .relhead', '.drawer .relhead h5', '.drawer .relhead time', '.drawer .chgs', '.drawer .chg', '.drawer .chg .k', '.drawer .chg .k .badge', '.drawer .rel.seen .chg', '.drawer .empty', '.badge.bloom']), []);
});

test('rail and rail tip: selectors present', () => {
  assert.deepEqual(missing(['.cside[data-collapsed]', '.cside[data-collapsed] :is(.snav .nl,.snav .cnt:not(.hot),.oname,.who,.collapse-row span,.platform .v)', '.cside[data-collapsed] :is(.grouplabel,.sgroup-head,.switcher .chev,.collapse-row kbd,.oword)', '.cside[data-collapsed] .switcher', '.cside[data-collapsed] .switcher.word .otile', '.cside[data-collapsed] .sgroup', '.cside[data-collapsed] .sgroup+.sgroup', '.cside[data-collapsed] .snav', '.cside[data-collapsed] .snav a', '.cside[data-collapsed] .snav a svg', '.cside[data-collapsed] .snav .ni', '.cside[data-collapsed] .snav .cnt.hot', '.cside[data-collapsed] .collapse-row', '.cside[data-collapsed] .collapse-row svg', '.cside[data-collapsed] .capsule', '.cside[data-collapsed] .acct', '.cside[data-collapsed] .platform', '.cside[data-collapsed] .menu-list.full', '.cside[data-collapsed] .menu-list.up', '.cside[data-collapsed] .snav[hidden]', '.railtip', '.railtip[hidden]']), []);
});

test('rail keeps every name: visually hidden, never display:none', () => {
  const hide = bodyOf('.cside[data-collapsed] :is(.snav .nl,.snav .cnt:not(.hot),.oname,.who,.collapse-row span,.platform .v)');
  assert.match(hide, /position:absolute/);
  assert.match(hide, /clip-path:inset\(50%\)/);
  assert.doesNotMatch(hide, /display:\s*none/);
  const NAMED = /\.(nl|who|oname)\b|\.platform \.v\b|\.collapse-row span\b/;
  const offenders = RULES.filter((r) => /display:\s*none/.test(r.body) && r.selectors.some((s) => s.startsWith('.cside[data-collapsed]') && NAMED.test(s)));
  assert.deepEqual(offenders.map((r) => r.selectors.join(',')), []);
});

test('stacking order matches the contract', () => {
  const z = (sel) => (bodyOf(sel).match(/z-index:(\d+)/) ?? [])[1];
  assert.deepEqual(
    { tbar: z('.tbar'), cside: z('.cside'), railtip: z('.railtip'), scrim: z('.scrim'), drawer: z('.drawer'), skip: z('.cshell .skip:focus') },
    { tbar: '12', cside: '13', railtip: '15', scrim: '16', drawer: '17', skip: '18' },
  );
});

test('tokens only: every var() resolves; no hex, rgba or !important in the section; no transform or filter on .cside', () => {
  const declared = new Set([...TOKENS_RAW.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]));
  const unknown = [...new Set([...RAW.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]))].filter((n) => !declared.has(n) && !LOCAL_VARS.includes(n));
  assert.deepEqual(unknown, [], 'every var() is a token or an allowed component-local property');
  const sec = section();
  assert.doesNotMatch(sec, /#[0-9a-f]{3,8}\b/i, 'no hex in the console shell section');
  assert.doesNotMatch(sec, /rgba?\(/i, 'no rgb/rgba literal in the console shell section');
  assert.doesNotMatch(sec, /!important/, 'no !important in the console shell section');
  for (const sel of ['.cside', '.cside[data-collapsed]']) {
    assert.doesNotMatch(bodyOf(sel), /(^|;)\s*(transform|filter|backdrop-filter|-webkit-backdrop-filter)\s*:/, `${sel} must not create a containing block for the fixed rail tip`);
  }
});

// ---- contrast on the glass sidebar (worst case: the catch-light's brightest stop everywhere) ----
test('contrast on glass: --text-1 and --text-2 clear 4.5:1 over the worst-case catch-light in both modes', () => {
  const fails = [];
  for (const mode of MODES) {
    const s = scene(mode, null);
    for (const [name, fg] of [['text-1', s.text1], ['text-2', s.text2]]) {
      const r = ratio(fg, s.glassTop);
      if (r < 4.5) fails.push(`${name} ${mode}: ${r.toFixed(2)}`);
    }
  }
  assert.deepEqual(fails, []);
});

test('contrast: the hot count sits its bloom on an opaque --surface-2 and clears 4.5:1 on every theme', () => {
  assert.match(bodyOf('.snav .cnt.hot'), /background:var\(--accent-bloom\),var\(--surface-2\)/);
  assert.deepEqual(eachScene((s) => ratio(s.text1, over(s.accent, s.bloomCenter, s.surface2))), []);
});

test('contrast: the org role lifts to --text-2 on the switcher hover wash', () => {
  assert.match(bodyOf('.switcher:hover .oname small'), /color:var\(--text-2\)/);
  assert.match(bodyOf('.switcher[aria-expanded="true"] .oname small'), /color:var\(--text-2\)/);
  assert.deepEqual(eachScene((s) => ratio(s.text2, over(s.text1, 0.06, s.surface2))), []);
});

test('contrast: the account email lifts to --text-2 on the capsule hover wash', () => {
  assert.match(bodyOf('button.acct:hover .who small'), /color:var\(--text-2\)/);
  assert.match(bodyOf('.acct[aria-expanded="true"] .who small'), /color:var\(--text-2\)/);
  assert.deepEqual(eachScene((s) => ratio(s.text2, over(s.text1, 0.06, s.surface2))), []);
});

test('contrast: unread notification meta lifts to --text-2 on the accent wash', () => {
  assert.match(bodyOf('.notif.unread .metaline'), /color:var\(--text-2\)/);
  assert.deepEqual(eachScene((s) => ratio(s.text2, over(s.accent, 0.05, s.surface))), []);
});

test('non-text contrast in the rail: icons (--text-3), letters (--text-2) and the urgent dot (--accent) clear 3:1 over the catch-light', () => {
  const fails = [];
  for (const brand of EVERY_THEME) for (const mode of MODES) {
    const s = scene(mode, brand);
    for (const [name, fg] of [['text-3', s.text3], ['text-2', s.text2], ['accent', s.accent]]) {
      const r = ratio(fg, s.glassTop);
      if (r < 3) fails.push(`${brand ?? 'base'} ${mode} ${name}: ${r.toFixed(2)}`);
    }
  }
  assert.deepEqual(fails, []);
});

// ---- reduced motion, deprecation, scrub ----
test('reduced motion: shell transitions, presses and the drawer are off, inside the existing block', () => {
  assert.equal(RAW.split('@media (prefers-reduced-motion:reduce)').length - 1, 2, 'no new reduced-motion block');
  const rm = '@media (prefers-reduced-motion:reduce)';
  for (const s of ['.switcher', '.acct', '.collapse-row', '.ibtn', '.platform', 'button.notif', 'a.notif']) assert.match(bodyOf(s, rm), /transition:none/, `${s} transition off`);
  for (const s of ['.switcher:active', 'button.acct:active', '.collapse-row:active', '.ibtn:active', '.platform:active']) assert.match(bodyOf(s, rm), /transform:none/, `${s} press off`);
  for (const s of ['.scrim', '.drawer']) assert.match(bodyOf(s, rm), /animation:none/, `${s} animation off`);
});

test('deprecation and scrub: .orgchip marked deprecated, no parent-company name', () => {
  assert.match(RAW, /\/\* \.orgchip is deprecated in 1\.3\.0 \(use \.switcher\); kept for existing copies, removed in 2\.0 \*\/\n\.orgchip\{/);
  assert.ok(SELECTORS.has('.orgchip'), '.orgchip stays until 2.0');
  assert.doesNotMatch(RAW, new RegExp(Buffer.from('bmVtaXhv', 'base64').toString(), 'i'));
});
