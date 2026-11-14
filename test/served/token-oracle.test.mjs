// The browser oracle for bin/token-resolver.mjs: Chrome loads the real tokens.css plus every
// themes/*.css, and for the signature and each [data-brand], in dark and light, every token the
// resolver emits is compared to what Chrome computes.
//
// How Chrome is read:
// - A token's TEXT is getComputedStyle(<html>).getPropertyValue('--x'): var() substituted,
//   color-mix() NOT evaluated (an unregistered custom property is a token stream).
// - A token's COLOR is the computed `color` of a probe element set to `color: var(--x)`. The probe
//   is read under two different parent colours: a value that is not a colour is invalid at
//   computed-value time and inherits, so it follows the parent; a real colour does not.
//
// What is compared, per token:
// - resolver 'color'      Chrome must compute a colour; r, g, b each within 1/255 (the resolver
//                         rounds to 8-bit at output) and alpha within ALPHA_TOLERANCE.
// - resolver 'string'     Chrome must NOT compute a colour, and the texts must be equal after
//                         normaliseText (the only normalisation: runs of whitespace become one
//                         space, ends trimmed; case, quotes, commas and numbers are untouched).
// - resolver 'unresolved' Chrome's text must be empty (guaranteed-invalid) and not a colour.
// Colours written inside a string token (the rgba() stops of a shadow or gradient, the
// color-mix() stops of --accent-bloom) are not evaluated by either side above, so each is also
// evaluated on its own, by parseColor and by Chrome, and compared like a colour token.
//
// EXCLUDED string tokens: none. Font stacks, shadows, easings and gradients all compare as text.
// What the text comparison does NOT prove is that a non-colour value means the same thing to a
// consumer (a font stack that resolves to the same font, say): text equality is the contract.
//
// Runs after `npm run studio:build && npm run assemble` (npm run test:served): the shared harness
// needs out/, though this page is served from the repo's own source files.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, root } from './chrome.mjs';
import { resolveTokens, parseColor, SIGNATURE, MODES } from '../../bin/token-resolver.mjs';

/** Alpha: Chrome serialises a legacy colour's alpha as the shortest decimal that lands on the same 8-bit step
 * (#11223380 reads back as 0.5, not 0.502), so up to half a step, plus the resolver's rounding to 4 places. */
const ALPHA_TOLERANCE = 0.5 / 255 + 0.00005;
const CHANNEL_TOLERANCE = 1; // in 8-bit units: 1/255

const themeFiles = fs.readdirSync(path.join(root, 'themes')).filter((f) => f.endsWith('.css')).sort();
const files = ['tokens.css', ...themeFiles.map((f) => `themes/${f}`)];
const cssTexts = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8'));

/** One page holding the given stylesheets in load order, and the probe. */
const pageOf = (texts) => {
  for (const t of texts) assert.ok(!/<\/style/i.test(t), 'a stylesheet would close its own <style>');
  return `<!doctype html><html><head><meta charset="utf-8">${texts.map((t) => `<style>${t}</style>`).join('')}</head><body><div id="parent"><span id="probe"></span></div></body></html>`;
};

/* Runs in Chrome. Sets the context on <html>, then reads every named token and evaluates every given colour text. */
function readInChrome({ brand, mode, names, colorTexts }) {
  const d = document.documentElement;
  if (brand) d.dataset.brand = brand; else delete d.dataset.brand;
  if (mode === 'light') d.dataset.theme = 'light'; else delete d.dataset.theme;
  const parent = document.getElementById('parent');
  const probe = document.getElementById('probe');
  const colorOf = (value) => {
    const under = (sentinel) => { parent.style.color = sentinel; probe.style.color = ''; probe.style.color = value; return getComputedStyle(probe).color; };
    const a = under('rgb(1, 2, 3)');
    const b = under('rgb(4, 5, 6)');
    return a === b ? a : null;
  };
  const html = getComputedStyle(d);
  const tokens = {};
  for (const name of names) tokens[name] = { text: html.getPropertyValue(`--${name}`), color: colorOf(`var(--${name})`) };
  return {
    declared: [...html].filter((n) => n.startsWith('--')).map((n) => n.slice(2)),
    tokens,
    colors: colorTexts.map(colorOf),
    attrs: { brand: d.getAttribute('data-brand'), theme: d.getAttribute('data-theme') },
  };
}

/** Chrome's computed colour to { r, g, b, a }: 0..255 channels (fractional for color(srgb ...)), alpha 0..1. */
export function parseChromeColor(text) {
  const legacy = text.match(/^rgba?\(([^()]+)\)$/);
  if (legacy) {
    const p = legacy[1].split(/\s*[,/]\s*|\s+/).map(Number);
    assert.ok((p.length === 3 || p.length === 4) && p.every(Number.isFinite), `cannot parse Chrome colour "${text}"`);
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  }
  const srgb = text.match(/^color\(srgb ([^()]+)\)$/);
  assert.ok(srgb, `cannot parse Chrome colour "${text}"`);
  const p = srgb[1].split(/\s*\/\s*|\s+/).map((s) => (s === 'none' ? 0 : Number(s)));
  assert.ok((p.length === 3 || p.length === 4) && p.every(Number.isFinite), `cannot parse Chrome colour "${text}"`);
  return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p[3] ?? 1 };
}

/** The only normalisation applied to string tokens. */
const normaliseText = (s) => s.replace(/\s+/g, ' ').trim();

/** The colours written inside a string value: each outermost rgb()/rgba()/color-mix() call and each hex. */
export function embeddedColors(value) {
  const found = [];
  const re = /(?<![\w-])(?:rgba?|color-mix)\(|#[0-9a-f]{3,8}(?![\w-])/gi;
  for (let m; (m = re.exec(value));) {
    if (m[0][0] === '#') { found.push(m[0]); continue; }
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < value.length; i++) {
      if (value[i] === '(') depth++;
      else if (value[i] === ')' && --depth === 0) break;
    }
    found.push(value.slice(m.index, i + 1));
    re.lastIndex = i + 1;
  }
  return found;
}

/** Why the two colours differ, or null. `mine` is 8-bit (resolver output) or unrounded (parseColor). */
function colorDiff(mine, chromeText) {
  if (chromeText === null) return 'Chrome does not compute a colour';
  const c = parseChromeColor(chromeText);
  /* A fully transparent colour has no meaningful channels: Chrome keeps them, premultiplied maths zeroes them. */
  if (mine.a === 0 && c.a === 0) return null;
  const off = ['r', 'g', 'b'].filter((k) => Math.abs(mine[k] - c[k]) > CHANNEL_TOLERANCE + 1e-9);
  if (off.length || Math.abs(mine.a - c.a) > ALPHA_TOLERANCE) return `channels ${off.join(',') || 'ok'}, alpha ${Math.abs(mine.a - c.a) > ALPHA_TOLERANCE ? 'off' : 'ok'}`;
  return null;
}

/**
 * Compares one resolved context to Chrome. Returns { counts, disagreements }; a disagreement is
 * { token, resolver, chrome, why }.
 */
async function compare(page, tokens, { brand, mode }) {
  const names = Object.keys(tokens);
  const embedded = [];
  for (const [name, t] of Object.entries(tokens)) {
    if (t.type === 'string') for (const text of embeddedColors(t.value)) embedded.push({ name, text });
  }
  const got = await page.evaluate(`(${readInChrome})(${JSON.stringify({ brand, mode, names, colorTexts: embedded.map((e) => e.text) })})`);
  assert.deepEqual(got.attrs, { brand: brand ?? null, theme: mode === 'light' ? 'light' : null }, 'the page is not in the context under test');
  const counts = { tokens: 0, color: 0, string: 0, unresolved: 0, embedded: 0 };
  const disagreements = [];
  const differ = (token, resolver, chrome, why) => disagreements.push({ token, resolver, chrome, why });
  for (const [name, t] of Object.entries(tokens)) {
    const c = got.tokens[name];
    counts.tokens++;
    counts[t.type]++;
    if (t.type === 'color') {
      const why = colorDiff(t, c.color);
      if (why) differ(name, `rgba(${t.r}, ${t.g}, ${t.b}, ${t.a})`, c.color ?? `not a colour; text "${c.text}"`, why);
    } else if (t.type === 'string') {
      if (c.color !== null) differ(name, `string "${t.value}"`, c.color, 'Chrome computes a colour, the resolver emits a string');
      else if (normaliseText(t.value) !== normaliseText(c.text)) differ(name, `string "${normaliseText(t.value)}"`, `"${normaliseText(c.text)}"`, 'texts differ');
    } else if (c.text !== '' || c.color !== null) {
      differ(name, `unresolved (${t.reason})`, c.color ?? `"${c.text}"`, 'Chrome holds a value, the resolver emits unresolved');
    }
  }
  for (const [i, { name, text }] of embedded.entries()) {
    counts.embedded++;
    const mine = parseColor(text);
    if (!mine) { differ(`${name} » ${text}`, 'parseColor: not a colour', got.colors[i] ?? 'not a colour', 'the resolver cannot evaluate a colour written inside a string token'); continue; }
    const why = colorDiff(mine, got.colors[i]);
    if (why) differ(`${name} » ${text}`, `rgba(${mine.r}, ${mine.g}, ${mine.b}, ${mine.a})`, got.colors[i] ?? 'not a colour', why);
  }
  /* Chrome lists every custom property declared on <html> (a cyclic one too, with empty text): the resolver must know exactly those. */
  const mineDeclared = [...names].sort();
  const chromeDeclared = [...got.declared].sort();
  if (JSON.stringify(mineDeclared) !== JSON.stringify(chromeDeclared)) {
    const only = (a, b) => a.filter((n) => !b.includes(n)).join(', ') || 'none';
    differ('(token set)', `only in resolver: ${only(mineDeclared, chromeDeclared)}`, `only in Chrome: ${only(chromeDeclared, mineDeclared)}`, 'the two sides hold different tokens');
  }
  return { counts, disagreements, got };
}

const report = (context, disagreements) => disagreements.map((d) => `${context} --${d.token}: resolver ${d.resolver} | Chrome ${d.chrome} (${d.why})`).join('\n');

test('parseChromeColor reads rgb(), rgba() and color(srgb ...)', () => {
  assert.deepEqual(parseChromeColor('rgb(232, 53, 46)'), { r: 232, g: 53, b: 46, a: 1 });
  assert.deepEqual(parseChromeColor('rgba(0, 0, 0, 0.24)'), { r: 0, g: 0, b: 0, a: 0.24 });
  assert.deepEqual(parseChromeColor('color(srgb 1 0 0.5 / 0.6)'), { r: 255, g: 0, b: 127.5, a: 0.6 });
  assert.deepEqual(parseChromeColor('color(srgb 0.2 0.4 1)'), { r: 51, g: 102, b: 255, a: 1 });
  assert.throws(() => parseChromeColor('oklch(0.5 0.1 20)'));
});

test('embeddedColors finds each outermost colour in a string token', () => {
  assert.deepEqual(embeddedColors('0 1px 2px rgba(0, 0, 0, .24), inset 0 0 #fff'), ['rgba(0, 0, 0, .24)', '#fff']);
  assert.deepEqual(embeddedColors('radial-gradient(color-mix(in srgb, #E8352E 55%, rgba(0,0,0,0)) 0%, transparent)'), ['color-mix(in srgb, #E8352E 55%, rgba(0,0,0,0))']);
  assert.deepEqual(embeddedColors('cubic-bezier(.2, 0, 0, 1)'), []);
});

// ---- synthetic probes --------------------------------------------------------
// Cases the package's own tokens do not exercise, each compared to Chrome the same way.
// --spec is the cascade probe: the (0,2,0) block comes FIRST, so only specificity, not source
// order, can make it win in "probe, light".
const PROBES = `[data-brand="probe"][data-theme="light"] { --spec: red; }
:root {
  --spec: black;
  --cycle-self: var(--cycle-self, red);
  --cycle-referrer: var(--cycle-self, blue);
  --fb-base: #0f0;
  --fb-self: var(--fb-base, var(--fb-self));
  --fb-missing: var(--no-such-token, var(--fb-missing));
  --loop-a: var(--loop-b, red);
  --loop-b: var(--loop-a);
  --mix-under: color-mix(in srgb, red 30%, blue 30%);
  --mix-over: color-mix(in srgb, red 80%, blue 60%);
  --mix-alpha: color-mix(in srgb, rgba(255, 0, 0, .5) 40%, #00f);
  --mix-transparent: color-mix(in srgb, #E8352E 28%, transparent);
  --hex8: #11223380;
}
[data-theme="light"] { --spec: lime; }
[data-brand="probe"] { --spec: blue; }`;

let run;
before(async () => { run = await start({ extra: { '/__token-oracle': pageOf(cssTexts), '/__token-oracle-probes': pageOf([PROBES]) } }); });
after(async () => { await run?.stop(); });

const resolved = resolveTokens(cssTexts, files);

test('the resolver resolves every token of the package, and every preset theme is under test', () => {
  assert.deepEqual(resolved.unresolved, []);
  assert.deepEqual(Object.keys(resolved.themes).sort(), [SIGNATURE, ...themeFiles.map((f) => f.replace(/\.css$/, ''))].sort());
  assert.ok(themeFiles.length >= 4, `only ${themeFiles.length} preset themes found`);
});

for (const theme of Object.keys(resolved.themes)) for (const mode of MODES) {
  test(`Chrome computes what the resolver emits: ${theme}, ${mode}`, { timeout: 60000 }, async () => {
    const page = await run.page({ scheme: mode });
    try {
      await page.goto('/__token-oracle');
      const tokens = resolved.themes[theme][mode];
      const { counts, disagreements } = await compare(page, tokens, { brand: theme === SIGNATURE ? undefined : theme, mode });
      assert.equal(disagreements.length, 0, `\n${report(`${theme} ${mode}`, disagreements)}`);
      /* Not vacuous: every resolver token was compared, and the floors hold. */
      assert.equal(counts.tokens, Object.keys(tokens).length);
      assert.equal(counts.color + counts.string, counts.tokens);
      assert.ok(counts.tokens >= 80, `only ${counts.tokens} tokens compared`);
      assert.ok(counts.color >= 33, `only ${counts.color} colour tokens compared`);
      assert.ok(counts.string >= 47, `only ${counts.string} string tokens compared`);
      assert.ok(counts.embedded >= 15, `only ${counts.embedded} colours inside string tokens compared`);
      console.log(`token oracle: ${theme} ${mode}: ${counts.tokens} tokens (${counts.color} colour, ${counts.string} string, 0 excluded), ${counts.embedded} colours inside strings`);
    } finally {
      await page.close();
    }
  });
}

test('the modes and brands differ in Chrome, so the contexts are not one context read ten times', { timeout: 60000 }, async () => {
  const page = await run.page();
  try {
    await page.goto('/__token-oracle');
    const read = async (brand, mode) => (await compare(page, resolved.themes[brand ?? SIGNATURE][mode], { brand, mode })).got.tokens;
    const dark = await read(undefined, 'dark');
    const light = await read(undefined, 'light');
    const cobalt = await read('cobalt', 'dark');
    assert.notEqual(dark.bg.color, light.bg.color);
    assert.notEqual(dark.accent.color, cobalt.accent.color);
  } finally {
    await page.close();
  }
});


/* KNOWN DIFFERENCES between the resolver and Chrome, each pinned so that a change on either side
   fails here. The resolver is deliberately left as it is: see the note on each. */
const KNOWN_DIFFERENCES = {
  /* --fb-base:#0f0; --fb-self:var(--fb-base, var(--fb-self)). The resolver counts every var() in a
     value as a dependency, fallbacks included (CSS Variables 1), so --fb-self is a cycle and
     UNRESOLVED. Chrome finds cycles while substituting: --fb-base is valid, the fallback is never
     taken, and --fb-self computes to #0f0. The resolver errs loud (unresolved, exit 1), never
     silently wrong, and no token of the package is written this way. */
  'fb-self': { resolver: 'unresolved', chromeText: '#0f0', chromeColor: 'rgb(0, 255, 0)' },
};

/* What Chrome computes for --spec in each context. */
const SPEC_IN_CHROME = { 'signature dark': 'rgb(0, 0, 0)', 'signature light': 'rgb(0, 255, 0)', 'probe dark': 'rgb(0, 0, 255)', 'probe light': 'rgb(255, 0, 0)' };

test('synthetic probes: cycles, color-mix percentages and alpha, 8-digit hex, specificity, against Chrome', { timeout: 60000 }, async () => {
  const page = await run.page();
  try {
    await page.goto('/__token-oracle-probes');
    const { themes } = resolveTokens([PROBES]);
    assert.deepEqual(Object.keys(themes), [SIGNATURE, 'probe']);
    for (const theme of Object.keys(themes)) for (const mode of MODES) {
      const context = `${theme} ${mode}`;
      const tokens = themes[theme][mode];
      const { counts, disagreements, got } = await compare(page, tokens, { brand: theme === SIGNATURE ? undefined : theme, mode });
      const unexpected = disagreements.filter((d) => !KNOWN_DIFFERENCES[d.token]);
      assert.equal(unexpected.length, 0, `\n${report(`probes, ${context}`, unexpected)}`);
      for (const [name, known] of Object.entries(KNOWN_DIFFERENCES)) {
        assert.equal(tokens[name].type, known.resolver, `--${name}: the resolver changed; revisit KNOWN_DIFFERENCES`);
        assert.deepEqual(got.tokens[name], { text: known.chromeText, color: known.chromeColor }, `--${name}: Chrome changed; revisit KNOWN_DIFFERENCES`);
        assert.ok(disagreements.some((d) => d.token === name), `--${name} now agrees with Chrome: remove it from KNOWN_DIFFERENCES`);
      }
      /* Not vacuous: every probe was compared, as the kind it was written to be. */
      assert.deepEqual(counts, { tokens: 13, color: 8, string: 0, unresolved: 5, embedded: 0 }, context);
      /* What Chrome does, stated outright: the plain cycle is invalid, its referrer takes the fallback. */
      assert.deepEqual(got.tokens['cycle-self'], { text: '', color: null }, context);
      assert.deepEqual(got.tokens['cycle-referrer'], { text: 'blue', color: 'rgb(0, 0, 255)' }, context);
      assert.equal(got.tokens.spec.color, SPEC_IN_CHROME[context], context);
    }
    console.log(`token oracle: probes: 13 tokens in each of 4 contexts, ${Object.keys(KNOWN_DIFFERENCES).length} known difference (${Object.keys(KNOWN_DIFFERENCES).join(', ')})`);
  } finally {
    await page.close();
  }
});
