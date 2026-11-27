// verseva board: the contract specimens under the themes a local manifest names, served on
// 127.0.0.1. Every guard on the trust boundary has a test here: the manifest and each theme
// are regular .css files (the manifest a regular file) inside the working directory, never a
// symlink or a FIFO; a bad manifest stops with one line and exit 2; the server answers only
// the package's own files and themes by manifest id, and 404s every other path, however it
// is encoded. Probes go out through http.request with the raw path, so nothing is normalized
// on the client side before the server sees it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'verseva.mjs');
const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'verseva-board-')));

const children = new Set();
after(() => { for (const c of children) c.kill('SIGKILL'); });

/** Runs the board. Resolves { url, child } once it prints its address, or { code, out } when it
    exits first. A run that does neither within 10s is killed and reported as a hang. */
function board(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, 'board', ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    let out = '';
    const t = setTimeout(() => { child.kill('SIGKILL'); resolve({ code: 'hang', out }); }, 10000);
    child.stdout.on('data', (d) => {
      out += d;
      const m = out.match(/^verseva board: (http:\/\/\S+\/)/m);
      if (m) { clearTimeout(t); resolve({ url: m[1], child, out }); }
    });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => { clearTimeout(t); children.delete(child); resolve({ code, out }); });
  });
}

async function stop(child) {
  const gone = new Promise((r) => child.once('exit', r));
  child.kill('SIGTERM');
  await gone;
  children.delete(child);
}

/** One line on stderr, exit 2, nothing that looks like a stack trace. */
function assertRefused(r, pattern) {
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, pattern);
  assert.equal(r.out.trimEnd().split('\n').length, 1, `expected one line, got:\n${r.out}`);
  assert.doesNotMatch(r.out, /\n\s+at /);
}

const THEME = '[data-brand="probe"] { --accent: var(--text-1); }\n';

/** A working directory with one theme and a manifest naming it. */
function project(themes = [{ id: 'probe', label: 'Probe', css: 'brand/probe.css' }]) {
  const cwd = tmp();
  fs.mkdirSync(path.join(cwd, 'brand'));
  fs.writeFileSync(path.join(cwd, 'brand', 'probe.css'), THEME);
  fs.writeFileSync(path.join(cwd, 'manifest.json'), JSON.stringify({ themes }));
  return cwd;
}

function get(url, target, { method = 'GET', host } = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: u.hostname, port: u.port, path: target, method, agent: false, headers: { host: host ?? u.host } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('without --manifest, or with a bad --port or an unknown flag, it stops with one line and exit 2', async () => {
  const cwd = project();
  assertRefused(await board([], cwd), /^verseva board: --manifest <file> is required/);
  assertRefused(await board(['--manifest'], cwd), /--manifest <file> is required/);
  for (const port of ['abc', '-1', '65536', '1.5', '']) {
    assertRefused(await board(['--manifest', 'manifest.json', '--port', port], cwd), /--port must be a whole number from 0 to 65535/);
  }
  assertRefused(await board(['--manifest', 'manifest.json', '--watch'], cwd), /unknown argument --watch/);
  assertRefused(await board(['--manifest', 'manifest.json', 'extra'], cwd), /unknown argument extra/);
});

test('a manifest outside the working directory is refused (exit 2)', async () => {
  const outside = project();
  const cwd = tmp();
  assertRefused(await board(['--manifest', path.join(outside, 'manifest.json')], cwd), /refused: .*manifest\.json is outside the working directory/);
  fs.mkdirSync(path.join(cwd, 'sub'));
  assertRefused(await board(['--manifest', '../manifest.json'], path.join(outside, 'brand')), /outside the working directory/);
});

test('a symlinked manifest, or one reached through a symlinked directory, is refused', async () => {
  const cwd = project();
  fs.symlinkSync(path.join(cwd, 'manifest.json'), path.join(cwd, 'link.json'));
  assertRefused(await board(['--manifest', 'link.json'], cwd), /refused: link\.json is a symlink/);
  fs.mkdirSync(path.join(cwd, 'real'));
  fs.copyFileSync(path.join(cwd, 'manifest.json'), path.join(cwd, 'real', 'manifest.json'));
  fs.symlinkSync(path.join(cwd, 'real'), path.join(cwd, 'linkdir'));
  assertRefused(await board(['--manifest', 'linkdir/manifest.json'], cwd), /refused: linkdir\/manifest\.json is a symlink/);
});

test('a FIFO as the manifest or a theme is refused without blocking', { skip: process.platform === 'win32' }, async () => {
  const cwd = project();
  execFileSync('mkfifo', [path.join(cwd, 'pipe.json')]);
  assertRefused(await board(['--manifest', 'pipe.json'], cwd), /refused: pipe\.json is not a regular file/);
  execFileSync('mkfifo', [path.join(cwd, 'brand', 'pipe.css')]);
  fs.writeFileSync(path.join(cwd, 'manifest.json'), JSON.stringify({ themes: [{ id: 'probe', label: 'Probe', css: 'brand/pipe.css' }] }));
  assertRefused(await board(['--manifest', 'manifest.json'], cwd), /refused: brand\/pipe\.css is not a regular file/);
  assertRefused(await board(['--manifest', 'brand'], cwd), /refused: brand is not a regular file/);
});

test('a large or malformed manifest fails with one line and exit 2, quoting none of its content', async () => {
  const cwd = project();
  fs.writeFileSync(path.join(cwd, 'big.json'), JSON.stringify({ themes: [], pad: 'x'.repeat(70 * 1024) }));
  assertRefused(await board(['--manifest', 'big.json'], cwd), /big\.json is over 64 KB/);
  fs.writeFileSync(path.join(cwd, 'bad.json'), '{"themes": [ \u001b[31mSECRET');
  const r = await board(['--manifest', 'bad.json'], cwd);
  assertRefused(r, /bad\.json is not valid JSON/);
  assert.doesNotMatch(r.out, /SECRET|\u001b/);
  assertRefused(await board(['--manifest', 'missing.json'], cwd), /missing\.json not found/);
});

test('a manifest of the wrong shape names the first problem in one line', async () => {
  const ok = { id: 'probe', label: 'Probe', css: 'brand/probe.css' };
  const cases = [
    [[], /must be an object with a "themes" array/],
    [{}, /must be an object with a "themes" array/],
    [{ themes: {} }, /must be an object with a "themes" array/],
    [{ themes: [], extra: 1 }, /unknown key "extra"/],
    [{ themes: [1] }, /themes\[0\] must be an object/],
    [{ themes: [{ ...ok, id: 'Probe' }] }, /themes\[0\]\.id must match/],
    [{ themes: [{ ...ok, id: '../x' }] }, /themes\[0\]\.id must match/],
    [{ themes: [{ ...ok, id: 'a'.repeat(65) }] }, /themes\[0\]\.id must match/],
    [{ themes: [ok, ok] }, /themes\[1\]\.id "probe" is a duplicate/],
    [{ themes: [{ ...ok, label: '' }] }, /themes\[0\]\.label must be 1 to 64 characters/],
    [{ themes: [{ ...ok, label: 'x'.repeat(65) }] }, /themes\[0\]\.label must be 1 to 64 characters/],
    [{ themes: [{ ...ok, label: 'a\u001bb' }] }, /themes\[0\]\.label has a control character/],
    [{ themes: [{ ...ok, label: 'a‮b' }] }, /themes\[0\]\.label has a control character/],
    [{ themes: [{ ...ok, css: 3 }] }, /themes\[0\]\.css must be a path string/],
    [{ themes: [{ ...ok, more: 1 }] }, /themes\[0\] has unknown key "more"/],
    [{ themes: Array.from({ length: 65 }, (_, i) => ({ ...ok, id: `t${i}` })) }, /at most 64 themes/],
  ];
  for (const [shape, pattern] of cases) {
    const cwd = project();
    fs.writeFileSync(path.join(cwd, 'manifest.json'), JSON.stringify(shape));
    assertRefused(await board(['--manifest', 'manifest.json'], cwd), pattern);
  }
});

test('a theme outside the working directory is refused (exit 2)', async () => {
  const outside = project();
  for (const css of [path.join(outside, 'brand', 'probe.css'), '../probe.css', 'brand/../../probe.css']) {
    const cwd = project([{ id: 'probe', label: 'Probe', css }]);
    fs.writeFileSync(path.join(path.dirname(cwd), 'probe.css'), THEME);
    assertRefused(await board(['--manifest', 'manifest.json'], cwd), /refused: theme "probe" is outside the working directory/);
  }
});

test('a non-.css theme, a symlinked theme and a theme behind a symlinked directory are refused', async () => {
  for (const name of ['probe.txt', 'probe.css.js', 'probe.CSS', 'probe']) {
    const cwd = project([{ id: 'probe', label: 'Probe', css: `brand/${name}` }]);
    fs.writeFileSync(path.join(cwd, 'brand', name), THEME);
    assertRefused(await board(['--manifest', 'manifest.json'], cwd), /refused: theme "probe" is not a \.css file/);
  }
  const cwd = project([{ id: 'probe', label: 'Probe', css: 'brand/link.css' }]);
  fs.symlinkSync(path.join(cwd, 'brand', 'probe.css'), path.join(cwd, 'brand', 'link.css'));
  assertRefused(await board(['--manifest', 'manifest.json'], cwd), /refused: brand\/link\.css is a symlink/);

  const dir = project([{ id: 'probe', label: 'Probe', css: 'linked/probe.css' }]);
  fs.symlinkSync(path.join(dir, 'brand'), path.join(dir, 'linked'));
  assertRefused(await board(['--manifest', 'manifest.json'], dir), /refused: linked\/probe\.css is a symlink/);
});

test('a hard-linked theme inside the working directory is served; a hard link outside it is still refused', async () => {
  /* pnpm stores package files as hard links: a preset in node_modules must work */
  const store = tmp();
  fs.writeFileSync(path.join(store, 'preset.css'), '[data-brand="probe"] { --accent: var(--text-2); }\n');
  const cwd = project([{ id: 'probe', label: 'Probe', css: 'brand/link.css' }]);
  fs.linkSync(path.join(store, 'preset.css'), path.join(cwd, 'brand', 'link.css'));
  const r = await board(['--manifest', 'manifest.json'], cwd);
  assert.ok(r.url, r.out);
  try {
    const res = await get(r.url, '/theme/probe.css');
    assert.equal(res.status, 200);
    assert.equal(res.body, fs.readFileSync(path.join(store, 'preset.css'), 'utf8'));
  } finally {
    await stop(r.child);
  }
  /* the second name of that link, outside the working directory, is refused by containment */
  const away = project([{ id: 'probe', label: 'Probe', css: path.join(store, 'preset.css') }]);
  assertRefused(await board(['--manifest', 'manifest.json'], away), /refused: theme "probe" is outside the working directory/);
});

test('run from the filesystem root, every file is outside the working directory', async () => {
  const cwd = project();
  assertRefused(await board(['--manifest', path.relative('/', path.join(cwd, 'manifest.json'))], '/'), /outside the working directory/);
});

test('a missing or oversized theme stops startup', async () => {
  const cwd = project([{ id: 'probe', label: 'Probe', css: 'brand/none.css' }]);
  assertRefused(await board(['--manifest', 'manifest.json'], cwd), /brand\/none\.css not found/);
  const big = project();
  fs.writeFileSync(path.join(big, 'brand', 'probe.css'), `/*${'x'.repeat(1024 * 1024)}*/`);
  assertRefused(await board(['--manifest', 'manifest.json'], big), /brand\/probe\.css is over 1 MB/);
});

test('a port already in use stops with one line and exit 2', async () => {
  const blocker = net.createServer();
  await new Promise((r) => blocker.listen(0, '127.0.0.1', r));
  const { port } = blocker.address();
  try {
    assertRefused(await board(['--manifest', 'manifest.json', '--port', String(port)], project()), new RegExp(`port ${port} is in use`));
  } finally {
    blocker.close();
  }
});

test('it binds 127.0.0.1 only, on a free port by default', async () => {
  const r = await board(['--manifest', 'manifest.json'], project());
  assert.ok(r.url, r.out);
  try {
    const u = new URL(r.url);
    assert.equal(u.hostname, '127.0.0.1');
    assert.ok(Number(u.port) > 0);
    assert.match(r.out, /1 theme/);
    /* the same port on another loopback address does not answer */
    await assert.rejects(new Promise((resolve, reject) => {
      const s = net.connect({ host: '::1', port: Number(u.port) }, () => { s.destroy(); resolve(); });
      s.on('error', reject);
    }));
  } finally {
    await stop(r.child);
  }
});

test('it serves the page, the package css and themes by id, with nosniff and the right types', async () => {
  const cwd = project([
    { id: 'probe', label: '<img src=x onerror=alert(1)> & "q" \'s', css: 'brand/probe.css' },
    { id: 'second', label: 'Second', css: 'brand/second.css' },
  ]);
  fs.writeFileSync(path.join(cwd, 'brand', 'second.css'), '[data-brand="second"] { --accent: var(--text-2); }\n');
  const r = await board(['--manifest', 'manifest.json'], cwd);
  assert.ok(r.url, r.out);
  try {
    const page = await get(r.url, '/');
    assert.equal(page.status, 200);
    assert.equal(page.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(page.headers['x-content-type-options'], 'nosniff');
    assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
    /* scripts run by hash, never by 'unsafe-inline': the one inline script's sha256, from the page served */
    const scriptSrc = page.headers['content-security-policy'].split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src '));
    assert.ok(scriptSrc, page.headers['content-security-policy']);
    assert.doesNotMatch(scriptSrc, /unsafe-inline/);
    const inline = [...page.body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(inline.length, 1);
    const hash = createHash('sha256').update(inline[0], 'utf8').digest('base64');
    assert.equal(scriptSrc, `script-src 'self' 'sha256-${hash}'`);
    assert.match(page.body, /<link rel="stylesheet" href="\/tokens\.css">/);
    assert.match(page.body, /<link rel="stylesheet" href="\/components\.css">/);
    assert.match(page.body, /data-board-theme="probe"/);
    assert.match(page.body, /data-board-theme="second"/);
    /* the label is text: escaped, never markup */
    assert.ok(page.body.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot; &#39;s'));
    assert.ok(!page.body.includes('<img src=x'));
    /* no theme path reaches the page */
    assert.ok(!page.body.includes('brand/probe.css'));
    /* specimens from the package, not new markup */
    for (const id of ['button', 'field', 'modal', 'table', 'menu', 'switcher']) assert.match(page.body, new RegExp(`<section class="comp" id="${id}">`));
    assert.equal((await get(r.url, '/?brand=probe')).status, 200);

    for (const [target, file] of [['/tokens.css', 'tokens.css'], ['/components.css', 'components.css'], ['/site.css', 'site/site.css']]) {
      const res = await get(r.url, target);
      assert.equal(res.status, 200, target);
      assert.equal(res.headers['content-type'], 'text/css; charset=utf-8', target);
      assert.equal(res.headers['x-content-type-options'], 'nosniff', target);
      assert.equal(res.body, fs.readFileSync(path.join(root, file), 'utf8'), target);
    }
    for (const target of ['/theme.js', '/board.js']) {
      const res = await get(r.url, target);
      assert.equal(res.status, 200, target);
      assert.equal(res.headers['content-type'], 'text/javascript; charset=utf-8', target);
    }
    const theme = await get(r.url, '/theme/probe.css');
    assert.equal(theme.status, 200);
    assert.equal(theme.headers['content-type'], 'text/css; charset=utf-8');
    assert.equal(theme.headers['x-content-type-options'], 'nosniff');
    assert.equal(theme.headers['cross-origin-resource-policy'], 'same-origin');
    assert.equal(theme.headers['cache-control'], 'no-store');
    assert.equal(theme.body, THEME);
    assert.equal((await get(r.url, '/tokens.css?v=2')).status, 200);
    const head = await get(r.url, '/theme/probe.css', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
  } finally {
    await stop(r.child);
  }
});

test('any other URL path is 404, including encoded traversal, double encoding and backslashes', async () => {
  const cwd = project();
  const r = await board(['--manifest', 'manifest.json'], cwd);
  assert.ok(r.url, r.out);
  const probes = [
    '/index.html/..', '/..', '/../package.json', '/%2e%2e/package.json', '/%2E%2E/package.json',
    '/%252e%252e/package.json', '/..%2fpackage.json', '/..%2Fpackage.json', '/..\\package.json',
    '/%5c..%5cpackage.json', '/theme/../tokens.css', '/theme/%2e%2e/tokens.css', '/theme/..%2f..%2fmanifest.json',
    '/theme/probe.css/', '/theme/Probe.css', '/theme/probe.CSS', '/theme/probe', '/theme/probe.css%00',
    '/theme/nope.css', '/theme/', '/theme', '//tokens.css', '/tokens.css/', '/./tokens.css', '/tokens.css%00',
    '/TOKENS.CSS', '/site/components.html', '/components.html', '/bin/cmd-board.mjs', '/package.json',
    '/registry.json', '/themes/cobalt.css', '/manifest.json', '/brand/probe.css', `/${cwd}/brand/probe.css`,
    '/etc/passwd', '/%2fetc%2fpasswd', `${r.url}package.json`, '*',
  ];
  try {
    for (const target of probes) {
      const res = await get(r.url, target);
      assert.equal(res.status, 404, target);
      assert.equal(res.headers['x-content-type-options'], 'nosniff', target);
      assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8', target);
      assert.equal(res.body, 'not found\n', target);
    }
    const post = await get(r.url, '/', { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
    assert.equal(post.headers['x-content-type-options'], 'nosniff');
  } finally {
    await stop(r.child);
  }
});

test('a request for another host name is refused (DNS rebinding)', async () => {
  const r = await board(['--manifest', 'manifest.json'], project());
  assert.ok(r.url, r.out);
  const { port } = new URL(r.url);
  try {
    for (const host of ['evil.example', `evil.example:${port}`, '127.0.0.1', `127.0.0.1:${Number(port) + 1}`, `localhost.evil.example:${port}`]) {
      const res = await get(r.url, '/theme/probe.css', { host });
      assert.equal(res.status, 421, host);
      assert.ok(!res.body.includes('--accent'), host);
      assert.equal(res.headers['x-content-type-options'], 'nosniff', host);
    }
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`]) assert.equal((await get(r.url, '/', { host })).status, 200, host);
  } finally {
    await stop(r.child);
  }
});

test('a cross-site request is refused before any file is served', async () => {
  const r = await board(['--manifest', 'manifest.json'], project());
  assert.ok(r.url, r.out);
  const send = (target, site) => {
    const u = new URL(r.url);
    return new Promise((resolve, reject) => {
      const req = http.request({ host: u.hostname, port: u.port, path: target, agent: false, headers: { 'sec-fetch-site': site } }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body, nosniff: res.headers['x-content-type-options'] }));
      });
      req.on('error', reject);
      req.end();
    });
  };
  try {
    for (const site of ['cross-site', 'same-site']) {
      for (const target of ['/theme/probe.css', '/', '/tokens.css']) {
        const res = await send(target, site);
        assert.equal(res.status, 403, `${site} ${target}`);
        assert.equal(res.nosniff, 'nosniff');
        assert.ok(!res.body.includes('--accent'));
      }
    }
    for (const site of ['same-origin', 'none']) assert.equal((await send('/theme/probe.css', site)).status, 200, site);
  } finally {
    await stop(r.child);
  }
});

test('a theme is re-read per request under the same guards', async () => {
  const cwd = project();
  const r = await board(['--manifest', 'manifest.json'], cwd);
  assert.ok(r.url, r.out);
  try {
    const edited = '[data-brand="probe"] { --accent: var(--text-2); }\n';
    fs.writeFileSync(path.join(cwd, 'brand', 'probe.css'), edited);
    assert.equal((await get(r.url, '/theme/probe.css')).body, edited);
    /* swapped for a symlink to a file outside the working directory after startup */
    const outside = tmp();
    fs.writeFileSync(path.join(outside, 'secret.css'), 'SECRET');
    fs.rmSync(path.join(cwd, 'brand', 'probe.css'));
    fs.symlinkSync(path.join(outside, 'secret.css'), path.join(cwd, 'brand', 'probe.css'));
    const res = await get(r.url, '/theme/probe.css');
    assert.equal(res.status, 404);
    assert.ok(!res.body.includes('SECRET'));
  } finally {
    await stop(r.child);
  }
});

test('the example manifest ships placeholder names and serves from the package root', async () => {
  const example = JSON.parse(fs.readFileSync(path.join(root, 'templates', 'theme-manifest.example.json'), 'utf8'));
  assert.deepEqual(example.themes.map((t) => t.id), ['cobalt', 'forest', 'violet', 'slate']);
  const r = await board(['--manifest', 'templates/theme-manifest.example.json'], root);
  assert.ok(r.url, r.out);
  try {
    assert.match(r.out, /4 themes/);
    for (const t of example.themes) {
      const res = await get(r.url, `/theme/${t.id}.css`);
      assert.equal(res.status, 200, t.id);
      assert.match(res.body, new RegExp(`\\[data-brand="${t.id}"\\]`));
    }
  } finally {
    await stop(r.child);
  }
});

test('every package file the board reads ships in the tarball', () => {
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' }));
  const shipped = new Set(pack.files.map((f) => f.path));
  for (const f of ['bin/cmd-board.mjs', 'bin/board-client.js', 'site/components.html', 'site/site.css', 'site/theme.js', 'tokens.css', 'components.css', 'templates/theme-manifest.example.json']) {
    assert.ok(shipped.has(f), `${f} is not in the package`);
  }
});
