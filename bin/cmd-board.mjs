/**
 * verseva board: every contract specimen under any set of theme files a local manifest names,
 * served on this machine, so a theme author sees a theme on the whole system without publishing
 * it. The repo is public and ships no brand: the themes come from the manifest, kept wherever
 * the author keeps private work.
 *
 * Manifest (JSON, at most 64 KB):
 *   { "themes": [ { "id": "<slug>", "label": "<text>", "css": "<path>" } ] }
 * id is the theme's [data-brand] slug (lowercase letters, digits and dashes, at most 64);
 * label is text, 1 to 64 characters, no control characters; css is a path resolved against the
 * working directory. At most 64 themes; unknown keys are refused.
 *
 * Trust boundary. The manifest and every theme file must be regular files inside the working
 * directory (resolved to its real path once): a path that leaves it, a symlink anywhere on the
 * path, a FIFO, a device or a directory is refused, and a theme must end in .css. Sizes are
 * checked from the stat before any read (manifest 64 KB, theme 1 MB), and the file is opened
 * with O_NOFOLLOW and O_NONBLOCK and re-checked by its descriptor. A theme is re-read on every
 * request under the same guards, so an edit shows on reload and a theme swapped for a symlink
 * after startup is a 404. A file with a second hard link is refused (that name could be a file
 * outside the working directory). The server binds 127.0.0.1 only, answers only a Host of
 * 127.0.0.1:<port> or localhost:<port> (DNS rebinding gets 421), refuses a request a browser marks
 * as started by another site (Sec-Fetch-Site, 403), takes GET and HEAD, and serves
 * a fixed set of package files plus /theme/<id>.css by manifest id. The URL is matched as raw
 * text against that set and is never decoded or joined onto a path: every other path is 404.
 * Every response carries nosniff; theme css goes out as text/css only, and no theme path
 * reaches the page. Labels are escaped into the page as text.
 *
 * Exit 2 with one line on any startup error; 0 on Ctrl+C.
 *
 * The pieces are exported for the next ticket's checks: loadManifest, readTheme, boardPage,
 * createBoardServer.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const match = 'board';
export const order = 67;
export const usage = ['npx verseva board --manifest <file> [--port <n>]'];

const MANIFEST_MAX = 64 * 1024;
const THEME_MAX = 1024 * 1024;
const MAX_THEMES = 64;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/;

export class BoardError extends Error {}

const printable = (s) => String(s).replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, '?');
const refused = (what) => new BoardError(`refused: ${what}`);

/** A regular file inside root, never through a symlink, read whole if it fits under max.
    `shown` names the file in errors; `outside` replaces it in the containment error. */
function guardedRead(root, given, max, { outside } = {}) {
  const shown = printable(given);
  const abs = path.resolve(root, given);
  if (!abs.startsWith(root + path.sep)) throw refused(`${outside ?? shown} is outside the working directory`);
  let st;
  try { st = fs.lstatSync(abs); } catch { throw new BoardError(`${shown} not found`); }
  if (st.isSymbolicLink()) throw refused(`${shown} is a symlink`);
  let real;
  try { real = fs.realpathSync(abs); } catch { throw new BoardError(`${shown} not found`); }
  if (real !== abs) throw refused(`${shown} is a symlink (or sits behind one)`);
  if (!st.isFile()) throw refused(`${shown} is not a regular file`);
  /* A second hard link can be a name for a file outside the working directory. */
  if (st.nlink > 1) throw refused(`${shown} has more than one hard link`);
  const over = () => new BoardError(`${shown} is over ${max >= 1024 * 1024 ? `${max / (1024 * 1024)} MB` : `${max / 1024} KB`}`);
  if (st.size > max) throw over();
  let fd;
  try {
    fd = fs.openSync(abs, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  } catch {
    throw refused(`${shown} could not be opened as a regular file`);
  }
  try {
    const fst = fs.fstatSync(fd);
    if (!fst.isFile() || fst.ino !== st.ino || fst.dev !== st.dev || fst.nlink > 1) throw refused(`${shown} changed while it was read`);
    /* Sized to the stat, one byte over: a file that grew since is refused, never read past max. */
    const cap = Math.min(fst.size, max);
    const buf = Buffer.alloc(cap + 1);
    let n = 0;
    for (let k; n <= cap && (k = fs.readSync(fd, buf, n, cap + 1 - n, null)) > 0;) n += k;
    if (n > cap) throw refused(`${shown} changed while it was read`);
    return buf.subarray(0, n).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The manifest's themes as [{ id, label, css }], or a BoardError naming the first problem. */
export function loadManifest(root, file) {
  const shown = printable(file);
  const text = guardedRead(root, file, MANIFEST_MAX);
  let data;
  try { data = JSON.parse(text); } catch { throw new BoardError(`${shown} is not valid JSON`); }
  if (!isObject(data) || !Array.isArray(data.themes)) throw new BoardError(`${shown} must be an object with a "themes" array`);
  for (const k of Object.keys(data)) if (k !== 'themes') throw new BoardError(`${shown} has unknown key "${printable(k).slice(0, 40)}"`);
  if (data.themes.length > MAX_THEMES) throw new BoardError(`${shown} names ${data.themes.length} themes; at most ${MAX_THEMES} themes`);
  const seen = new Set();
  return data.themes.map((t, i) => {
    const at = `themes[${i}]`;
    if (!isObject(t)) throw new BoardError(`${at} must be an object`);
    for (const k of Object.keys(t)) if (!['id', 'label', 'css'].includes(k)) throw new BoardError(`${at} has unknown key "${printable(k).slice(0, 40)}"`);
    if (typeof t.id !== 'string' || !ID.test(t.id)) throw new BoardError(`${at}.id must match ${ID.source} (the theme's [data-brand] slug)`);
    if (seen.has(t.id)) throw new BoardError(`${at}.id "${t.id}" is a duplicate`);
    seen.add(t.id);
    if (typeof t.label !== 'string' || t.label.length < 1 || t.label.length > 64) throw new BoardError(`${at}.label must be 1 to 64 characters`);
    if (CONTROL.test(t.label)) throw new BoardError(`${at}.label has a control character`);
    if (typeof t.css !== 'string' || !t.css || t.css.length > 1024) throw new BoardError(`${at}.css must be a path string`);
    return { id: t.id, label: t.label, css: t.css };
  });
}

/** One theme's css, read now under every guard. */
export function readTheme(root, theme) {
  if (path.extname(theme.css) !== '.css') throw refused(`theme "${theme.id}" is not a .css file`);
  return guardedRead(root, theme.css, THEME_MAX, { outside: `theme "${theme.id}"` });
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* Each anchor in the specimen page must be found exactly once, or the page has changed shape
   and the board says so instead of serving a half-wired page. */
function replaceOnce(html, pattern, to, name) {
  const hits = html.match(new RegExp(pattern.source, 'g'))?.length ?? 0;
  if (hits !== 1) throw new BoardError(`site/components.html: expected one ${name}, found ${hits}`);
  return html.replace(pattern, to);
}

const TICK = '<svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';

/** The Components page, rewired: package css by absolute path, the brand switcher in the topbar,
    and the theme link the switcher drives. Labels go in escaped; nothing else from the manifest does. */
export function boardPage(componentsHtml, themes) {
  const item = (id, label, checked) => `<button type="button" class="menu-item" role="menuitemradio" aria-checked="${checked}" tabindex="-1" data-board-theme="${id}">${escapeHtml(label)}${TICK}</button>`;
  const switcher = [
    '<nav aria-label="Brand theme"><div class="menu" id="board-switcher">',
    '<button type="button" class="btn btn-secondary sm" id="board-current" aria-haspopup="menu" aria-expanded="false" aria-controls="board-themes">Baseline</button>',
    '<div class="menu-list" id="board-themes" role="menu" aria-label="Brand themes" hidden>',
    item('', 'Baseline', true),
    themes.length ? '<div class="menu-sep" role="separator"></div>' : '',
    ...themes.map((t) => item(t.id, t.label, false)),
    '</div></div></nav>',
  ].join('');
  let html = componentsHtml;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, '<title>VERSEVA Design · Board</title>', 'title');
  html = replaceOnce(html, /<link rel="stylesheet" href="\.\.\/tokens\.css[^"]*">/, '<link rel="stylesheet" href="/tokens.css">', 'tokens.css link');
  html = replaceOnce(html, /<link rel="stylesheet" href="\.\.\/components\.css[^"]*">/, '<link rel="stylesheet" href="/components.css">', 'components.css link');
  html = replaceOnce(html, /<link rel="stylesheet" href="site\.css[^"]*">/, '<link rel="stylesheet" href="/site.css">\n<link rel="stylesheet" id="board-theme">', 'site.css link');
  html = replaceOnce(html, /<script src="theme\.js[^"]*"><\/script>/, '<script src="/theme.js"></script>\n<script src="/board.js" defer></script>', 'theme.js script');
  html = replaceOnce(html, /<a class="wordmark" href="index\.html">/, '<a class="wordmark" href="/">', 'wordmark');
  html = replaceOnce(html, /(<header class="topbar">[\s\S]*?)<nav>[\s\S]*?<\/nav>/, (_, head) => head + switcher, 'topbar nav');
  html = replaceOnce(html, /<h1>Components<\/h1>/, '<h1>Board</h1>', 'hero heading');
  return html;
}

const CSS = 'text/css; charset=utf-8';
const JS = 'text/javascript; charset=utf-8';
const HTML = 'text/html; charset=utf-8';
const TEXT = 'text/plain; charset=utf-8';
const CSP = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const THEME_PATH = /^\/theme\/([a-z0-9][a-z0-9-]{0,63})\.css$/;

/** The board's http server, not yet listening. Hosts are allowed once the port is known. */
export function createBoardServer({ root, pkgRoot, themes, onThemeRefused = () => {} }) {
  const read = (rel) => fs.readFileSync(path.join(pkgRoot, rel), 'utf8');
  const files = new Map([
    ['/', [HTML, boardPage(read('site/components.html'), themes)]],
    ['/tokens.css', [CSS, read('tokens.css')]],
    ['/components.css', [CSS, read('components.css')]],
    ['/site.css', [CSS, read('site/site.css')]],
    ['/theme.js', [JS, read('site/theme.js')]],
    ['/board.js', [JS, read('bin/board-client.js')]],
  ]);
  const byId = new Map(themes.map((t) => [t.id, t]));
  const hosts = new Set();
  const server = http.createServer((req, res) => {
    const send = (status, type, body, extra = {}) => {
      const buf = Buffer.from(body, 'utf8');
      res.writeHead(status, {
        'content-type': type,
        'content-length': buf.length,
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
        'cross-origin-resource-policy': 'same-origin',
        ...extra,
      });
      res.end(req.method === 'HEAD' ? undefined : buf);
    };
    if (!hosts.has(req.headers.host)) return send(421, TEXT, 'misdirected request\n');
    /* A browser marks a request another site started; only this page and direct loads are served. */
    const site = req.headers['sec-fetch-site'];
    if (site !== undefined && site !== 'same-origin' && site !== 'none') return send(403, TEXT, 'forbidden\n');
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, TEXT, 'method not allowed\n', { allow: 'GET, HEAD' });
    /* Raw text, query dropped: never decoded, never joined onto a path. */
    const raw = req.url ?? '';
    const q = raw.indexOf('?');
    const p = q === -1 ? raw : raw.slice(0, q);
    const file = files.get(p);
    if (file) return send(200, file[0], file[1], file[0] === HTML ? { 'content-security-policy': CSP } : {});
    const m = THEME_PATH.exec(p);
    const theme = m && byId.get(m[1]);
    if (theme) {
      try {
        return send(200, CSS, readTheme(root, theme));
      } catch (e) {
        onThemeRefused(theme, e);
      }
    }
    return send(404, TEXT, 'not found\n');
  });
  /* A local tool for one person: a few connections, short timeouts, so a stuck client cannot hold it. */
  server.maxConnections = 64;
  server.headersTimeout = 5000;
  server.requestTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.allowPort = (port) => {
    hosts.clear();
    hosts.add(`127.0.0.1:${port}`);
    hosts.add(`localhost:${port}`);
  };
  return server;
}

function parseArgs(argv) {
  const args = [...argv];
  args.splice(args.indexOf('board'), 1);
  let manifest = null;
  let port = 0;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--manifest') {
      const v = args[++i];
      if (typeof v !== 'string' || !v || v.startsWith('--')) throw new BoardError('--manifest <file> is required');
      manifest = v;
    } else if (a === '--port') {
      const v = args[++i];
      if (typeof v !== 'string' || !/^\d{1,5}$/.test(v) || Number(v) > 65535) throw new BoardError('--port must be a whole number from 0 to 65535');
      port = Number(v);
    } else {
      throw new BoardError(`unknown argument ${printable(a).slice(0, 60)}`);
    }
  }
  if (!manifest) throw new BoardError('--manifest <file> is required (npx verseva board --manifest <file> [--port <n>])');
  return { manifest, port };
}

export async function run({ pkgRoot }) {
  const fail = (e) => {
    console.error(`verseva board: ${e instanceof BoardError ? e.message : printable(String(e?.message ?? e).split('\n')[0])}`);
    process.exit(2);
  };
  let server;
  let themes;
  try {
    const { manifest, port } = parseArgs(process.argv.slice(2));
    const root = fs.realpathSync(process.cwd());
    themes = loadManifest(root, manifest);
    for (const t of themes) readTheme(root, t);
    const here = pkgRoot ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    server = createBoardServer({
      root,
      pkgRoot: here,
      themes,
      onThemeRefused: (t, e) => console.error(`verseva board: theme "${t.id}" not served (${e instanceof BoardError ? e.message : 'unreadable'})`),
    });
    await new Promise((resolve, reject) => {
      server.once('error', (e) => reject(e.code === 'EADDRINUSE' ? new BoardError(`port ${port} is in use`) : e));
      server.listen(port, '127.0.0.1', resolve);
    });
  } catch (e) {
    fail(e);
  }
  const { port } = server.address();
  server.allowPort(port);
  const n = themes.length;
  console.log(`verseva board: http://127.0.0.1:${port}/ (${n} theme${n === 1 ? '' : 's'}; Ctrl+C stops it)`);
  const quit = () => { server.close(); process.exit(0); };
  process.once('SIGINT', quit);
  process.once('SIGTERM', quit);
  /* Never returns while serving: returning would hand over to the help text and exit 2. */
  await new Promise(() => {});
}
