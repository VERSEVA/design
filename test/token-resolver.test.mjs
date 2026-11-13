import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { resolveTokens } from '../bin/token-resolver.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const cli = path.join(root, 'bin', 'resolve-tokens.mjs');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const themeFiles = fs.readdirSync(path.join(root, 'themes')).filter((f) => f.endsWith('.css')).sort();

const color = (r, g, b, a = 1) => ({ type: 'color', r, g, b, a });
const string = (value) => ({ type: 'string', value });
const one = (css, name = 'x', theme = 'signature', mode = 'dark') => resolveTokens([css]).themes[theme][mode][name];

const LAYERS = `
  :root { --x: #010101; --root-only: #020202; }
  [data-theme="light"] { --x: #030303; --light-only: #040404; --flip: #050505; }
  [data-brand="acme"] { --x: #060606; --flip: #070707; }
  [data-brand="acme"][data-theme="light"] { --x: #080808; }
`;

test('cascade: root is the dark signature', () => {
  const { signature } = resolveTokens([LAYERS]).themes;
  assert.deepEqual(signature.dark.x, color(1, 1, 1));
  assert.equal(signature.dark['light-only'], undefined);
});

test('cascade: the light flip overrides root in light only', () => {
  const { signature } = resolveTokens([LAYERS]).themes;
  assert.deepEqual(signature.light.x, color(3, 3, 3));
  assert.deepEqual(signature.light['root-only'], color(2, 2, 2));
  assert.deepEqual(signature.light['light-only'], color(4, 4, 4));
});

test('cascade: the brand block overrides root, and (equal specificity, later source) the light flip', () => {
  const { acme } = resolveTokens([LAYERS]).themes;
  assert.deepEqual(acme.dark.x, color(6, 6, 6));
  assert.deepEqual(acme.dark['root-only'], color(2, 2, 2));
  assert.deepEqual(acme.light.flip, color(7, 7, 7));
  assert.deepEqual(acme.light['light-only'], color(4, 4, 4));
});

test('cascade: the brand light block wins on specificity, even written first', () => {
  assert.deepEqual(resolveTokens([LAYERS]).themes.acme.light.x, color(8, 8, 8));
  const reordered = `
    [data-brand="acme"][data-theme="light"] { --x: #080808; }
    [data-brand="acme"] { --x: #060606; }
    [data-theme="light"] { --x: #030303; }
    :root { --x: #010101; }
  `;
  const { acme, signature } = resolveTokens([reordered]).themes;
  assert.deepEqual(acme.light.x, color(8, 8, 8));
  // equal specificity (0,1,0) three ways: the last in source order wins
  assert.deepEqual(acme.dark.x, color(1, 1, 1));
  assert.deepEqual(signature.light.x, color(1, 1, 1));
});

test('cascade: source order runs across files, and later declarations win inside a block', () => {
  const out = resolveTokens([':root { --x: #010101; --x: #020202; }', '[data-brand="b"] { --y: #030303 }']);
  assert.deepEqual(out.themes.signature.dark.x, color(2, 2, 2));
  assert.deepEqual(out.themes.b.dark.y, color(3, 3, 3));
  assert.deepEqual(Object.keys(out.themes), ['signature', 'b']);
});

test('var(): a chain resolves to the end value', () => {
  assert.deepEqual(one(':root { --a: #0A0B0C; --b: var(--a); --c: var(--b); --x: var( --c ); }'), color(10, 11, 12));
});

test('var(): fallbacks, including a nested var() fallback', () => {
  assert.deepEqual(one(':root { --x: var(--missing, #010203); }'), color(1, 2, 3));
  assert.deepEqual(one(':root { --b: #040506; --x: var(--missing, var(--b)); }'), color(4, 5, 6));
  assert.deepEqual(one(':root { --a: #070809; --b: #040506; --x: var(--a, var(--b)); }'), color(7, 8, 9));
  assert.deepEqual(one(':root { --x: 1px var(--missing, 2px, 3px); }'), string('1px 2px, 3px'));
});

test('var(): late binding, a redefined dependency moves every token that references it', () => {
  const css = `
    :root { --accent: #FF0000; --alias: var(--accent); --tint: color-mix(in srgb, var(--accent) 50%, transparent); --ring: 0 0 0 2px var(--alias); }
    [data-theme="light"] { --accent: #00FF00; }
    [data-brand="acme"] { --accent: #0000FF; }
  `;
  const { signature, acme } = resolveTokens([css]).themes;
  assert.deepEqual(signature.dark.alias, color(255, 0, 0));
  assert.deepEqual(signature.light.alias, color(0, 255, 0));
  assert.deepEqual(acme.dark.alias, color(0, 0, 255));
  assert.deepEqual(acme.light.tint, color(0, 0, 255, 0.5));
  assert.deepEqual(signature.light.tint, color(0, 255, 0, 0.5));
  assert.deepEqual(acme.dark.ring, string('0 0 0 2px #0000FF'));
});

test('var(): a missing reference or a cycle is marked unresolved, never guessed', () => {
  const out = resolveTokens([':root { --x: var(--nope); --a: var(--b); --b: var(--a); --ok: #010101; }']);
  assert.equal(out.themes.signature.dark.x.type, 'unresolved');
  assert.equal(out.themes.signature.dark.x.value, 'var(--nope)');
  assert.equal(out.themes.signature.dark.a.type, 'unresolved');
  assert.deepEqual(out.unresolved.map((u) => u.token).sort(), ['a', 'a', 'b', 'b', 'x', 'x']);
});

test('var(): a self-reference or a loop is invalid even with a fallback; referrers take their own fallback', () => {
  assert.equal(one(':root { --x: var(--x, red); }').type, 'unresolved');
  const loop = resolveTokens([':root { --a: var(--b, red); --b: var(--a, blue); --x: var(--a, green); --y: var(--a); }']).themes.signature.dark;
  assert.equal(loop.a.type, 'unresolved');
  assert.equal(loop.b.type, 'unresolved');
  assert.deepEqual(loop.x, color(0, 128, 0));
  assert.equal(loop.y.type, 'unresolved');
  // a loop that only closes through a fallback reference is still a loop
  const viaFallback = resolveTokens([':root { --ok: #010101; --p: var(--q); --q: var(--ok, var(--p)); --x: var(--q, #020202); }']).themes.signature.dark;
  assert.equal(viaFallback.q.type, 'unresolved');
  assert.equal(viaFallback.p.type, 'unresolved');
  assert.deepEqual(viaFallback.x, color(2, 2, 2));
  // two paths to one token is not a loop
  assert.deepEqual(one(':root { --a: #010101; --b: var(--a); --c: var(--a); --x: color-mix(in srgb, var(--b), var(--c)); }'), color(1, 1, 1));
});

test('var(): the function name is case-insensitive', () => {
  assert.deepEqual(one(':root { --x: VAR(--m, red); }'), color(255, 0, 0));
  assert.deepEqual(one(':root { --a: #010203; --x: Var(--a); }'), color(1, 2, 3));
});

test('braces inside quoted values do not end the block', () => {
  const t = resolveTokens([':root{--q:"}"; --x:#010101} [data-theme="light"]{--p:\'{\'; --x:#020202}']).themes.signature;
  assert.deepEqual(t.dark.q, string('"}"'));
  assert.deepEqual(t.dark.x, color(1, 1, 1));
  assert.deepEqual(t.light.x, color(2, 2, 2));
});

test('scanner: an escaped quote, an apostrophe in an unquoted url() and a comment opener in a string are text', () => {
  const dark = (css) => resolveTokens([css]).themes.signature.dark;
  let t = dark(':root{--q:"a\\"}"; --x:#010101}');
  assert.deepEqual(t.q, string('"a\\"}"'));
  assert.deepEqual(t.x, color(1, 1, 1));
  t = dark(":root{--q:'a\\'{'; --x:#010101}");
  assert.deepEqual(t.q, string("'a\\'{'"));
  assert.deepEqual(t.x, color(1, 1, 1));
  t = dark(":root{--u:url(it's.png); --x:#010101; --v: URL( a'b\\).png ) 1px; --y:#020202}");
  assert.deepEqual(t.u, string("url(it's.png)"));
  assert.deepEqual(t.x, color(1, 1, 1));
  assert.deepEqual(t.v, string("URL( a'b\\).png ) 1px"));
  assert.deepEqual(t.y, color(2, 2, 2));
  t = dark(':root{--q:"/*"; --x:#010101; /* c */ --y:#020202; --z: 1px /* } */ 2px}');
  assert.deepEqual(t.q, string('"/*"'));
  assert.deepEqual(t.x, color(1, 1, 1));
  assert.deepEqual(t.y, color(2, 2, 2));
  assert.deepEqual(t.z, string('1px  2px'));
  assert.deepEqual(one(':root{--u:url("a)b.png"); --x: var(--u) #010101}'), string('url("a)b.png") #010101'));
});

test('scanner: a stylesheet that ends inside a quote, a comment, a url() or a block throws, naming the input', () => {
  const ok = ':root{--x:#010101}';
  assert.throws(() => resolveTokens([ok, '[data-brand="b"]{--q:"oops; --x:#020202}']), /input 1: unclosed quote/);
  assert.throws(() => resolveTokens([ok, '[data-brand="b"]{--x:#020202']), /input 1: unclosed \{/);
  assert.throws(() => resolveTokens([':root{--x:#010101; --y:#020202']), /input 0: unclosed \{/);
  assert.throws(() => resolveTokens([':root{--x:#010101} /* trailing']), /input 0: unclosed comment/);
  assert.throws(() => resolveTokens([':root{--u:url(a.png; --x:#010101}']), /input 0: unclosed url\(/);
  assert.throws(() => resolveTokens([ok, ':root{--y:"}'], ['tokens.css', 'themes/b.css']), /themes\/b\.css: unclosed quote/);
});

test('substitution is linear: a 22-level chain that doubles at every level resolves quickly', () => {
  const levels = 22;
  const css = `:root{--t0:1;${Array.from({ length: levels }, (_, i) => `--t${i + 1}:var(--t${i}) var(--t${i});`).join('')}}`;
  const started = performance.now();
  const t = resolveTokens([css]).themes.signature.dark;
  const elapsed = performance.now() - started;
  assert.deepEqual(t.t3, string('1 1 1 1 1 1 1 1'));
  assert.equal(t[`t${levels}`].type, 'string');
  assert.equal(t[`t${levels}`].value.length, 2 ** (levels + 1) - 1);
  assert.ok(elapsed < 3000, `took ${Math.round(elapsed)}ms`);
});

test('a malformed hex or a color keyword with no fixed value is unresolved, never a plain string', () => {
  for (const v of ['#12345', '#1234567', '#12', '#xyz', 'currentColor', 'currentcolor']) {
    const out = one(`:root { --x: ${v}; }`);
    assert.equal(out.type, 'unresolved', v);
    assert.equal(out.value, v);
    assert.ok(out.reason.length > 0);
  }
  // documented limitation: named colors outside the 16 basic keywords are not recognised
  assert.deepEqual(one(':root { --x: rebeccapurple; }'), string('rebeccapurple'));
});

test('dark is the absence of data-theme: a [data-theme="dark"] block is refused, not folded into dark', () => {
  assert.throws(() => resolveTokens([':root{--x:#010101} [data-theme=dark]{--x:#020202}']), /data-theme="dark".*no data-theme attribute/);
  assert.throws(() => resolveTokens([':root{--x:#010101} [data-brand="b"][data-theme="sepia"]{--x:#020202}']), /data-theme="sepia"/);
});

test('an at-rule that precedes or wraps custom properties is named as such', () => {
  for (const css of ['@import "x.css"; :root { --x: #010101; }', '@layer a, b; :root { --x: #010101; }', '@charset "utf-8"; :root { --x: #010101; }']) {
    assert.throws(() => resolveTokens([css]), /unsupported at-rule "@(import|layer|charset)/, css);
  }
});

test('package.json reaches the CLI through the tokens:resolve script only; no published command', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(!Object.values(pkg.bin).includes('bin/resolve-tokens.mjs'));
  assert.equal(pkg.scripts['tokens:resolve'], 'node bin/resolve-tokens.mjs');
  const out = JSON.parse(execFileSync('npm', ['run', '-s', 'tokens:resolve'], { cwd: root, encoding: 'utf8' }));
  assert.deepEqual(out.unresolved, []);
  assert.ok(out.themes.signature.dark.bg);
});

test('color-mix(): with transparent keeps the hue and scales alpha (premultiplied)', () => {
  assert.deepEqual(one(':root { --x: color-mix(in srgb, #E8352E 36%, transparent); }'), color(232, 53, 46, 0.36));
  assert.deepEqual(one(':root { --x: color-mix(in srgb, transparent, #E8352E 36%); }'), color(232, 53, 46, 0.36));
  assert.deepEqual(one(':root { --x: color-mix(in srgb, transparent, transparent); }'), color(0, 0, 0, 0));
});

test('color-mix(): with a named color', () => {
  // .55 * (232, 53, 46) + .45 * 255 = (242.35, 143.9, 140.05)
  assert.deepEqual(one(':root { --x: color-mix(in srgb, #E8352E 55%, white); }'), color(242, 144, 140));
  assert.deepEqual(one(':root { --x: color-mix(in srgb, white, black); }'), color(128, 128, 128));
  assert.deepEqual(one(':root { --x: color-mix(in srgb, 25% red, blue); }'), color(64, 0, 191));
});

test('color-mix(): percentages that do not sum to 100', () => {
  // sum 40 < 100: weights normalise to 50/50 and alpha is multiplied by .4
  assert.deepEqual(one(':root { --x: color-mix(in srgb, red 20%, blue 20%); }'), color(128, 0, 128, 0.4));
  // sum 120 > 100: weights normalise to 75/25, alpha untouched
  assert.deepEqual(one(':root { --x: color-mix(in srgb, red 90%, blue 30%); }'), color(191, 0, 64));
  // a single percentage outside 0..100 is invalid
  assert.equal(one(':root { --x: color-mix(in srgb, red 150%, blue 50%); }').type, 'unresolved');
  assert.equal(one(':root { --x: color-mix(in srgb, red 0%, blue 0%); }').type, 'unresolved');
});

test('color-mix(): interpolates premultiplied when both sides carry alpha, and nests', () => {
  // alpha = .5*.5 + 1*.5 = .75; r = 255*.5*.5/.75 = 85; b = 255*1*.5/.75 = 170
  assert.deepEqual(one(':root { --x: color-mix(in srgb, rgba(255, 0, 0, .5), rgb(0 0 255)); }'), color(85, 0, 170, 0.75));
  assert.deepEqual(one(':root { --x: color-mix(in srgb, color-mix(in srgb, red, blue) 50%, transparent); }'), color(128, 0, 128, 0.5));
});

test('color-mix(): a space this resolver does not implement is left unresolved', () => {
  const v = one(':root { --x: color-mix(in oklch, red, blue); }');
  assert.equal(v.type, 'unresolved');
  assert.equal(v.value, 'color-mix(in oklch, red, blue)');
});

test('colors normalise to 8-bit channels and a float alpha', () => {
  const css = `:root {
    --hex6: #0B0D10; --hex3: #FA0; --hex8: #FF000080; --hex4: #F008;
    --rgba: rgba(255, 255, 255, .06); --space: rgb(15 18 30 / 50%); --pct: rgb(100%, 0%, 50%);
    --named: white; --clear: transparent;
  }`;
  const t = resolveTokens([css]).themes.signature.dark;
  assert.deepEqual(t.hex6, color(11, 13, 16));
  assert.deepEqual(t.hex3, color(255, 170, 0));
  assert.deepEqual(t.hex8, color(255, 0, 0, 0.502));
  assert.deepEqual(t.hex4, color(255, 0, 0, 0.5333));
  assert.deepEqual(t.rgba, color(255, 255, 255, 0.06));
  assert.deepEqual(t.space, color(15, 18, 30, 0.5));
  assert.deepEqual(t.pct, color(255, 0, 128));
  assert.deepEqual(t.named, color(255, 255, 255));
  assert.deepEqual(t.clear, color(0, 0, 0, 0));
});

test('non-color values stay strings with var() substituted', () => {
  const css = `:root {
    --sans: 'Manrope', system-ui; --display: 'Archivo', var(--sans);
    --r-md: 14px; --r-btn: var(--r-md); --dur: 120ms; --ease: cubic-bezier(.2, 0, 0, 1);
    --line: #010101; --shadow: 0 1px 2px var(--line), inset 0 0 0 1px rgba(0, 0, 0, .5);
    --grad: linear-gradient(168deg, color-mix(in srgb, var(--line) 55%, transparent) 0%, transparent 100%);
    --none: none; --weight: 650;
  }`;
  const t = resolveTokens([css]).themes.signature.dark;
  assert.deepEqual(t.display, string("'Archivo', 'Manrope', system-ui"));
  assert.deepEqual(t['r-btn'], string('14px'));
  assert.deepEqual(t.dur, string('120ms'));
  assert.deepEqual(t.ease, string('cubic-bezier(.2, 0, 0, 1)'));
  assert.deepEqual(t.shadow, string('0 1px 2px #010101, inset 0 0 0 1px rgba(0, 0, 0, .5)'));
  assert.deepEqual(t.grad, string('linear-gradient(168deg, color-mix(in srgb, #010101 55%, transparent) 0%, transparent 100%)'));
  assert.deepEqual(t.none, string('none'));
  assert.deepEqual(t.weight, string('650'));
});

test('a selector the resolver cannot place in the cascade is an error, not a guess', () => {
  assert.throws(() => resolveTokens(['.card { --x: #010101; }']), /unsupported selector/);
  assert.throws(() => resolveTokens(['@media (prefers-color-scheme: light) { :root { --x: #010101; } }']), /unsupported at-rule "@media/);
  assert.doesNotThrow(() => resolveTokens([':root { --x: #010101; } .card { color: red; }']));
});

test('the shipped tokens.css and every preset resolve fully, in both modes', () => {
  const out = resolveTokens([read('tokens.css'), ...themeFiles.map((f) => read('themes', f))]);
  const slugs = themeFiles.map((f) => path.basename(f, '.css'));
  assert.ok(slugs.length >= 4);
  assert.deepEqual(Object.keys(out.themes).sort(), ['signature', ...slugs].sort());
  assert.deepEqual(out.unresolved, []);
  const names = Object.keys(out.themes.signature.dark);
  assert.ok(names.length >= 80);
  for (const [theme, modes] of Object.entries(out.themes)) {
    assert.deepEqual(Object.keys(modes), ['dark', 'light']);
    for (const [mode, tokens] of Object.entries(modes)) {
      assert.deepEqual(Object.keys(tokens), names, `${theme}.${mode} token set`);
      for (const [name, v] of Object.entries(tokens)) {
        assert.ok(v.type === 'color' || v.type === 'string', `${theme}.${mode}.${name} is ${v.type}`);
        if (v.type === 'string') assert.ok(!v.value.includes('var('), `${theme}.${mode}.${name} keeps a var(`);
        else assert.ok([v.r, v.g, v.b].every((c) => Number.isInteger(c) && c >= 0 && c <= 255) && v.a >= 0 && v.a <= 1);
      }
    }
  }
});

test('the shipped values land where a browser puts them', () => {
  const t = resolveTokens([read('tokens.css'), ...themeFiles.map((f) => read('themes', f))]).themes;
  assert.deepEqual(t.signature.dark.accent, color(232, 53, 46));
  assert.deepEqual(t.signature.light.accent, color(196, 43, 33));
  assert.deepEqual(t.cobalt.dark.accent, color(77, 159, 255));
  assert.deepEqual(t.cobalt.light.accent, color(29, 78, 216));
  // late binding through the brand: the ladder follows the brand accent
  assert.deepEqual(t.signature.dark['data-1'], color(232, 53, 46, 0.36));
  assert.deepEqual(t.cobalt.dark['data-1'], color(77, 159, 255, 0.36));
  assert.deepEqual(t.cobalt.light['data-3'], color(29, 78, 216));
  assert.deepEqual(t.signature.dark['data-0'], color(244, 245, 247, 0.08));
  assert.deepEqual(t.signature.light['data-0'], color(14, 17, 22, 0.08));
  // accent-on: a white mix in dark, var(--accent-hover) in light (the light flip redefines it)
  assert.deepEqual(t.signature.dark['accent-on'], color(242, 144, 140));
  assert.deepEqual(t.signature.light['accent-on'], color(166, 33, 25));
  assert.deepEqual(t.cobalt.light['accent-on'], color(26, 63, 176));
  // untouched by the brand: inherited from the signature for that mode
  assert.deepEqual(t.cobalt.light.bg, color(244, 245, 248));
  assert.deepEqual(t.cobalt.dark.hairline, color(255, 255, 255, 0.08));
  assert.deepEqual(t.cobalt.dark['chart-grid'], color(255, 255, 255, 0.08));
  assert.deepEqual(t.signature.dark['r-btn'], string('14px'));
  assert.match(t.cobalt.light['accent-bloom'].value, /^radial-gradient\(.*color-mix\(in srgb, #1D4ED8 30%, transparent\) 0%/);
});

test('CLI: prints the resolved JSON for the package by default, and for --tokens files', () => {
  const all = JSON.parse(execFileSync(process.execPath, [cli], { encoding: 'utf8' }));
  assert.deepEqual(all, JSON.parse(JSON.stringify(resolveTokens([read('tokens.css'), ...themeFiles.map((f) => read('themes', f))]))));
  const some = JSON.parse(execFileSync(process.execPath, [cli, '--tokens', path.join(root, 'tokens.css'), '--tokens', path.join(root, 'themes', 'forest.css')], { encoding: 'utf8' }));
  assert.deepEqual(Object.keys(some.themes), ['signature', 'forest']);
  assert.deepEqual(some.themes.forest.light.accent, color(14, 122, 70));
});

test('CLI: a malformed stylesheet exits 1, prints no JSON and names the file', () => {
  const bad = path.join(here, 'fixtures', 'tokens-unclosed.css');
  assert.throws(
    () => execFileSync(process.execPath, [cli, '--tokens', path.join(root, 'tokens.css'), '--tokens', bad], { encoding: 'utf8', stdio: 'pipe' }),
    (e) => e.status === 1 && e.stdout === '' && /tokens-unclosed\.css: unclosed quote/.test(e.stderr),
  );
});

test('CLI: usage errors exit 2', () => {
  for (const args of [['--tokens'], ['--tokens', path.join(root, 'no-such.css')], ['stray']]) {
    assert.throws(() => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', stdio: 'pipe' }), (e) => e.status === 2);
  }
});
