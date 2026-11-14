import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveTokens } from '../bin/token-resolver.mjs';
import { emitSwift, swiftFields, swiftIdentifier, mapFields, MAPPED, EXCLUDED, GENERATED_HEADER } from '../bin/swift-emitter.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const cli = path.join(root, 'bin', 'emit-swift.mjs');
const generatedDir = path.join(root, 'swift', 'Sources', 'VersevaDesign', 'Generated');
const typesFile = path.join(root, 'swift', 'Sources', 'VersevaDesign', 'Tokens', 'TokenValues.swift');

const inputs = ['tokens.css', ...fs.readdirSync(path.join(root, 'themes')).filter((f) => f.endsWith('.css')).sort().map((f) => `themes/${f}`)];
const resolved = () => resolveTokens(inputs.map((p) => fs.readFileSync(path.join(root, p), 'utf8')), inputs);
const emit = (r = resolved()) => emitSwift(r, { inputs });
/* A resolved set with one change applied to every theme and mode. */
const patched = (change) => {
  const r = resolved();
  for (const theme of Object.values(r.themes)) for (const mode of Object.values(theme)) change(mode);
  return r;
};
const isExcluded = (t) => EXCLUDED.some((e) => e.tokens.includes(t));
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });

test('one file per theme, named after the theme', () => {
  assert.deepEqual(Object.keys(emit()).sort(), ['CobaltTokens.swift', 'ForestTokens.swift', 'SignatureTokens.swift', 'SlateTokens.swift', 'VioletTokens.swift']);
});

test('every file opens with the generated header: script, inputs, do not edit', () => {
  for (const [name, text] of Object.entries(emit())) {
    const head = text.split('\n').slice(0, 8).join('\n');
    assert.match(head, /^\/\/ GENERATED FILE\. DO NOT EDIT BY HAND\./, name);
    assert.match(head, /bin\/emit-swift\.mjs/, name);
    assert.match(head, /npm run tokens:swift/, name);
    for (const input of inputs) assert.ok(head.includes(input), `${name} header names ${input}`);
  }
});

test('generated files hold plain data only: no imports', () => {
  for (const [name, text] of Object.entries(emit())) assert.doesNotMatch(text, /^\s*import\s/m, name);
});

test('each theme declares a dark and a light TokenSet', () => {
  const text = emit()['CobaltTokens.swift'];
  assert.match(text, /^public enum CobaltTokens \{$/m);
  assert.match(text, /^ {4}public static let dark = TokenSet\($/m);
  assert.match(text, /^ {4}public static let light = TokenSet\($/m);
});

test('colors are RGBA doubles from 0 to 1, alpha kept', () => {
  const text = emit()['SignatureTokens.swift'];
  assert.ok(text.includes('bg: TokenColor(r: 0.043137, g: 0.05098, b: 0.062745, a: 1.0),'));
  assert.ok(text.includes('hairline: TokenColor(r: 1.0, g: 1.0, b: 1.0, a: 0.08),'));
  assert.ok(text.includes('accentHover: TokenColor('));
  assert.ok(text.includes('text1: TokenColor('));
  assert.ok(text.includes('successBg: TokenColor('));
  assert.ok(text.includes('dataAlt: TokenColor('));
});

test('spacing and radius are points, durations seconds, weights numbers', () => {
  const text = emit()['SignatureTokens.swift'];
  assert.ok(text.includes('s4: 16.0,'));
  assert.ok(text.includes('s10: 128.0,'));
  assert.ok(text.includes('rSm: 10.0,'));
  assert.ok(text.includes('rBtn: 14.0,'));
  assert.ok(text.includes('dur1: 0.12,'));
  assert.ok(text.includes('dur4: 0.48,'));
  assert.ok(text.includes('displayWeight: 650,'));
});

test('easing keeps the four cubic-bezier control values', () => {
  const text = emit()['SignatureTokens.swift'];
  assert.ok(text.includes('easeStandard: TimingCurve(x1: 0.2, y1: 0.0, x2: 0.0, y2: 1.0),'));
  assert.ok(text.includes('easeBack: TimingCurve(x1: 0.34, y1: 1.56, x2: 0.64, y2: 1.0)'));
});

test('shadows keep offset and color, drop the spread, halve the blur, and say so', () => {
  const text = emit()['SignatureTokens.swift'];
  /* dark --e-2: 0 6px 20px -6px rgba(0, 0, 0, .28) */
  assert.ok(text.includes('e2: TokenShadow(x: 0.0, y: 6.0, radius: 10.0, color: TokenColor(r: 0.0, g: 0.0, b: 0.0, a: 0.28)),'));
  /* light --e-1: 0 1px 2px rgba(0, 0, 0, .10) */
  assert.ok(text.includes('e1: TokenShadow(x: 0.0, y: 1.0, radius: 1.0, color: TokenColor(r: 0.0, g: 0.0, b: 0.0, a: 0.1)),'));
  assert.match(text, /\/\/.*spread is dropped/);
  assert.match(text, /\/\/.*blur divided by 2/);
});

test('excluded tokens are left out, --r-pill among them', () => {
  const text = emit()['SignatureTokens.swift'];
  for (const id of ['rPill', 'glassBlur', 'glassFill3', 'navGap', 'navMain', 'accentBloom', 'accentActiveGlow', 'surfaceBody', 'containerProse', 'fontSans']) {
    assert.ok(!new RegExp(`\\b${id}:`).test(text), `${id} must not be emitted`);
  }
});

test('every exclusion carries a reason, and no token is both mapped and excluded', () => {
  for (const e of EXCLUDED) assert.ok(e.reason && e.reason.length > 10, `${e.family} needs a reason`);
  assert.deepEqual(MAPPED.filter((m) => isExcluded(m.token)).map((m) => m.token), []);
});

test('exclusions are exact token names, never a prefix or a pattern', () => {
  for (const e of EXCLUDED) {
    assert.ok(Array.isArray(e.tokens) && e.tokens.length > 0, `${e.family} lists its tokens`);
    for (const t of e.tokens) assert.match(t, /^[a-z][a-z0-9-]*$/, `${e.family}: ${t}`);
    assert.equal(e.match, undefined, `${e.family} must not match by function`);
  }
  const all = EXCLUDED.flatMap((e) => e.tokens);
  assert.equal(new Set(all).size, all.length, 'a token is excluded twice');
  /* Every excluded name is a real token: a retired token leaves the list too. */
  const names = Object.keys(resolved().themes.signature.dark);
  assert.deepEqual(all.filter((t) => !names.includes(t)), []);
});

test('a new token in an excluded family still forces a decision', () => {
  for (const token of ['glass-new-thing', 'nav-accent', 'container-narrow', 'font-serif']) {
    const r = patched((mode) => { mode[token] = { type: 'string', value: '4px' }; });
    assert.throws(() => emit(r), new RegExp(`--${token}.*neither mapped nor excluded`, 's'), token);
  }
});

test('every token in tokens.css is either mapped or excluded: 80 in, none unaccounted', () => {
  const names = Object.keys(resolved().themes.signature.dark);
  const mapped = new Set(MAPPED.map((m) => m.token));
  const excluded = names.filter(isExcluded);
  assert.equal(names.length, 80);
  assert.equal(names.filter((t) => mapped.has(t)).length + excluded.length, names.length);
  assert.equal(names.filter((t) => mapped.has(t)).length, MAPPED.length);
});

test('a token that is neither mapped nor excluded fails loudly, by name', () => {
  const r = patched((mode) => { mode['brand-new'] = { type: 'string', value: '4px' }; });
  assert.throws(() => emit(r), /--brand-new.*neither mapped nor excluded/s);
});

test('a new member of a mapped family still forces a decision', () => {
  const r = patched((mode) => { mode['s-11'] = { type: 'string', value: '160px' }; });
  assert.throws(() => emit(r), /--s-11/);
});

test('a mapped token that is missing fails loudly', () => {
  const r = patched((mode) => { delete mode['s-4']; });
  assert.throws(() => emit(r), /--s-4.*missing/s);
});

test('a mapped token of the wrong shape fails loudly', () => {
  assert.throws(() => emit(patched((m) => { m.accent = { type: 'string', value: 'red' }; })), /--accent/);
  assert.throws(() => emit(patched((m) => { m['s-4'] = { type: 'string', value: '1rem' }; })), /--s-4/);
  assert.throws(() => emit(patched((m) => { m['dur-1'] = { type: 'string', value: 'fast' }; })), /--dur-1/);
  assert.throws(() => emit(patched((m) => { m['ease-emph'] = { type: 'string', value: 'ease-in' }; })), /--ease-emph/);
  assert.throws(() => emit(patched((m) => { m['btn-weight'] = { type: 'string', value: 'bold' }; })), /--btn-weight/);
  assert.throws(() => emit(patched((m) => { m['e-1'] = { type: 'string', value: '0 1px 2px rgba(0, 0, 0, .2), 0 2px 4px rgba(0, 0, 0, .2)' }; })), /--e-1/);
  assert.throws(() => emit(patched((m) => { m['e-1'] = { type: 'string', value: 'inset 0 1px 2px rgba(0, 0, 0, .2)' }; })), /--e-1/);
});

test('out-of-range values are rejected, naming the token and the value', () => {
  const bad = (token, value) => assert.throws(
    () => emit(patched((m) => { m[token] = { type: 'string', value }; })),
    (e) => e.message.includes(`--${token}`) && e.message.includes(value),
    `--${token}: ${value} must be rejected`,
  );
  bad('s-4', '-16px');
  bad('r-md', '-2px');
  bad('s-4', '0.0000001px');
  bad('dur-1', '-120ms');
  bad('dur-1', '-1s');
  bad('dur-1', '0.0001ms');
  bad('btn-weight', '0');
  bad('btn-weight', '1001');
  bad('ease-emph', 'cubic-bezier(-.1, 0, .1, 1)');
  bad('ease-emph', 'cubic-bezier(.3, 0, 1.2, 1)');
  bad('e-1', '0 1px 0.0000001px rgba(0, 0, 0, .2)');
});

test('in-range edges still pass: zero written as zero, weights 1 and 1000, y outside 0 to 1', () => {
  const ok = (token, value, expected) => {
    const text = emit(patched((m) => { m[token] = { type: 'string', value }; }))['SignatureTokens.swift'];
    assert.ok(text.includes(expected), `--${token}: ${value} should emit ${expected}`);
  };
  ok('s-1', '0px', 's1: 0.0,');
  ok('s-1', '0', 's1: 0.0,');
  ok('dur-1', '0ms', 'dur1: 0.0,');
  ok('btn-weight', '1', 'btnWeight: 1,');
  ok('btn-weight', '1000', 'btnWeight: 1000,');
  ok('ease-emph', 'cubic-bezier(0, -0.5, 1, 1.56)', 'easeEmph: TimingCurve(x1: 0.0, y1: -0.5, x2: 1.0, y2: 1.56),');
});

test('a brand name that is not a plain slug is rejected, so it cannot inject Swift', () => {
  const withBrand = (slug) => { const r = resolved(); r.themes[slug] = r.themes.cobalt; return r; };
  const inject = 'x\n}\npublic let injected = 1 //';
  assert.throws(() => emit(withBrand(inject)), (e) => /brand/.test(e.message) && e.message.includes(JSON.stringify(inject)));
  for (const slug of ['Acme', '9lives', 'a b', 'a_b', 'a/b', '']) assert.throws(() => emit(withBrand(slug)), /brand/, JSON.stringify(slug));
  assert.ok('AcmeCoTokens.swift' in emit(withBrand('acme-co')));
});

test('an input label that would break out of the header comment is rejected', () => {
  assert.throws(() => emitSwift(resolved(), { inputs: ['tokens.css', 'x.css\npublic let injected = 1'] }), /input/);
});

test('Swift keywords are refused as identifiers', () => {
  const keywords = ['associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate', 'func', 'import', 'init', 'inout', 'internal',
    'let', 'operator', 'precedencegroup', 'private', 'protocol', 'public', 'rethrows', 'static', 'struct', 'subscript', 'typealias', 'var',
    'break', 'case', 'catch', 'continue', 'default', 'defer', 'do', 'else', 'fallthrough', 'for', 'guard', 'if', 'in', 'repeat', 'return',
    'switch', 'throw', 'where', 'while', 'as', 'await', 'false', 'is', 'nil', 'self', 'super', 'throws', 'true', 'try'];
  for (const k of keywords) assert.throws(() => swiftIdentifier(k), new RegExp(`--${k}\\b`), k);
  assert.equal(swiftIdentifier('accent-hover'), 'accentHover');
});

test('two tokens that camel-case to the same identifier are a collision', () => {
  const groups = [{ title: 'Color roles', kind: 'color', tokens: ['text-1', 'text1'] }];
  assert.throws(() => mapFields(groups), (e) => e.message.includes('--text-1') && e.message.includes('--text1 '));
  assert.throws(() => mapFields([{ title: 'a', kind: 'color', tokens: ['bg'] }, { title: 'b', kind: 'length', tokens: ['bg'] }]), /--bg/);
});

test('an unresolved value fails loudly', () => {
  const r = resolved();
  r.unresolved.push({ theme: 'signature', mode: 'dark', token: 'accent', value: 'var(--nope)', reason: 'missing' });
  assert.throws(() => emit(r), /unresolved/);
});

test('output is deterministic: two runs are byte-identical', () => {
  assert.deepEqual(emit(), emit());
});

test('output has no tabs, no trailing whitespace, and ends with one newline', () => {
  for (const [name, text] of Object.entries(emit())) {
    assert.doesNotMatch(text, /\t/, name);
    assert.doesNotMatch(text, /[ ]+$/m, name);
    assert.match(text, /[^\n]\n$/, name);
  }
});

/* The three places TokenSet names its fields: the stored properties, the init parameters
   and the init assignments. Every line of each block must parse, or this throws. */
function tokenSetShape(swift) {
  const m = swift.match(/public struct TokenSet: Sendable, Equatable \{\n([\s\S]*?)\n\n {4}public init\(\n([\s\S]*?)\n {4}\) \{\n([\s\S]*?)\n {4}\}\n\}/);
  assert.ok(m, 'TokenSet struct, with its init, not found in TokenValues.swift');
  const lines = (block, pattern, what) => block.split('\n').map((line) => {
    const hit = pattern.exec(line);
    assert.ok(hit, `TokenSet ${what}: unexpected line "${line}"`);
    return hit;
  });
  const fields = lines(m[1], /^ {4}public let (\w+): (\w+)$/, 'field').map((h) => ({ name: h[1], type: h[2] }));
  const paramLines = lines(m[2], /^ {8}(\w+): (\w+)(,?)$/, 'init parameter');
  paramLines.forEach((h, i) => assert.equal(h[3], i === paramLines.length - 1 ? '' : ',', `TokenSet init parameter ${h[1]}: comma`));
  const params = paramLines.map((h) => ({ name: h[1], type: h[2] }));
  const assignments = lines(m[3], /^ {8}self\.(\w+) = (\w+)$/, 'init assignment').map((h) => {
    assert.equal(h[1], h[2], `TokenSet init assigns self.${h[1]} from ${h[2]}`);
    return h[1];
  });
  return { fields, params, assignments };
}

test('the hand-written TokenSet matches the emitter: fields, init parameters and assignments, in order', () => {
  const shape = tokenSetShape(fs.readFileSync(typesFile, 'utf8'));
  assert.deepEqual(shape.fields, swiftFields());
  assert.deepEqual(shape.params, swiftFields());
  assert.deepEqual(shape.assignments, swiftFields().map((f) => f.name));
});

test('the TokenSet check catches a reordered init, a swapped or dropped assignment and a retyped parameter', () => {
  const swift = fs.readFileSync(typesFile, 'utf8');
  const edit = (from, to) => { assert.ok(swift.includes(from), from); return swift.replace(from, to); };

  const reordered = tokenSetShape(edit('        bg: TokenColor,\n        surface: TokenColor,\n', '        surface: TokenColor,\n        bg: TokenColor,\n'));
  assert.deepEqual(reordered.fields, swiftFields());
  assert.notDeepEqual(reordered.params, swiftFields());

  assert.throws(() => tokenSetShape(edit('        self.bg = bg\n', '        self.bg = surface\n')), /self\.bg from surface/);

  const dropped = tokenSetShape(edit('        self.s4 = s4\n', ''));
  assert.notDeepEqual(dropped.assignments, swiftFields().map((f) => f.name));

  const retyped = tokenSetShape(edit('        s4: Double,\n', '        s4: Int,\n'));
  assert.notDeepEqual(retyped.params, swiftFields());
});

test('drift: the committed Swift files match tokens.css and the themes', () => {
  const r = run('--check');
  assert.equal(r.status, 0, `${r.stderr}\nThe committed Swift token files are stale. Regenerate them with: npm run tokens:swift`);
});

test('drift check: a stale, missing or stray file fails and says how to regenerate', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-swift-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  assert.equal(run('--out', dir).status, 0);
  assert.deepEqual(fs.readdirSync(dir).sort(), Object.keys(emit()).sort());
  assert.equal(run('--check', '--out', dir).status, 0);

  const cobalt = path.join(dir, 'CobaltTokens.swift');
  const good = fs.readFileSync(cobalt, 'utf8');
  fs.writeFileSync(cobalt, good.replace('s4: 16.0', 's4: 17.0'));
  let r = run('--check', '--out', dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /CobaltTokens\.swift.*stale/);
  assert.match(r.stderr, /npm run tokens:swift/);

  fs.rmSync(cobalt);
  r = run('--check', '--out', dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /CobaltTokens\.swift.*missing/);

  fs.writeFileSync(cobalt, good);
  fs.writeFileSync(path.join(dir, 'RetiredTokens.swift'), good);
  r = run('--check', '--out', dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /RetiredTokens\.swift.*no theme/);
  assert.match(r.stderr, /npm run tokens:swift/);

  /* Regenerating removes the stray file and passes again. */
  assert.equal(run('--out', dir).status, 0);
  assert.equal(run('--check', '--out', dir).status, 0);
});

test('--out never deletes or overwrites a file it did not generate', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-swift-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  /* A copy of the hand-written Tokens/ folder: the write is refused, by file name, and nothing changes. */
  const types = fs.readFileSync(typesFile, 'utf8');
  fs.writeFileSync(path.join(dir, 'TokenValues.swift'), types);
  let r = run('--out', dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /TokenValues\.swift/);
  assert.match(r.stderr, /not a generated file/);
  assert.deepEqual(fs.readdirSync(dir), ['TokenValues.swift']);
  assert.equal(fs.readFileSync(path.join(dir, 'TokenValues.swift'), 'utf8'), types);

  /* A hand-written file that sits on a generated name is not overwritten either. */
  fs.rmSync(path.join(dir, 'TokenValues.swift'));
  fs.writeFileSync(path.join(dir, 'CobaltTokens.swift'), 'public let mine = 1\n');
  r = run('--out', dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /CobaltTokens\.swift/);
  assert.deepEqual(fs.readdirSync(dir), ['CobaltTokens.swift']);
  assert.equal(fs.readFileSync(path.join(dir, 'CobaltTokens.swift'), 'utf8'), 'public let mine = 1\n');
  r = run('--check', '--out', dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /CobaltTokens\.swift.*not a generated file/);

  /* A file with the header whose name does not end in Tokens.swift is left alone, as is a non-Swift file. */
  fs.rmSync(path.join(dir, 'CobaltTokens.swift'));
  fs.writeFileSync(path.join(dir, 'Index.swift'), `${GENERATED_HEADER}\npublic let index = 1\n`);
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'keep\n');
  assert.equal(run('--out', dir).status, 0);
  assert.ok(fs.existsSync(path.join(dir, 'Index.swift')));
  assert.ok(fs.existsSync(path.join(dir, 'notes.txt')));
  assert.ok(fs.existsSync(path.join(dir, 'CobaltTokens.swift')));
});

test('the CLI header says it is not a registered package command, and does not claim to be unpublished', () => {
  const src = fs.readFileSync(cli, 'utf8');
  assert.doesNotMatch(src, /not a published command/i);
  assert.match(src, /not registered as a package command/i);
});

test('CLI usage errors exit 2', () => {
  assert.equal(run('stray').status, 2);
  assert.equal(run('--out').status, 2);
});

const swiftc = spawnSync('swiftc', ['--version'], { encoding: 'utf8' });
const hasSwiftc = !swiftc.error && swiftc.status === 0;
test('swiftc -typecheck: the types file and every generated file are valid Swift 6', {
  skip: hasSwiftc ? false : 'swiftc not found on this machine: Swift validity NOT checked here (run on a Mac with the Swift toolchain)',
  timeout: 300000,
}, () => {
  const files = [typesFile, ...fs.readdirSync(generatedDir).filter((f) => f.endsWith('.swift')).sort().map((f) => path.join(generatedDir, f))];
  assert.equal(files.length, 6);
  const r = spawnSync('swiftc', ['-typecheck', '-swift-version', '6', '-warnings-as-errors', '-module-name', 'VersevaDesign', ...files], { encoding: 'utf8' });
  assert.equal(r.status, 0, `swiftc -typecheck failed:\n${r.stdout}\n${r.stderr}`);
});
