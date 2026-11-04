// vercel.json's routing, modeled for the served tests: redirects first (first match wins,
// `has` query conditions honored, the query passed through), then the filesystem (a file,
// or <path>/index.html), else Vercel's 404.html. Covers only the source syntax vercel.json
// uses here: literal segments, ":name" (one segment) and ":name*" (any tail).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SITE = 'https://design.verseva.com';
export const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

function compile(source) {
  const names = [];
  const re = source
    .split(/(\/:\w+\*|:\w+)/)
    .map((part) => {
      const star = part.match(/^\/:(\w+)\*$/);
      if (star) { names.push(star[1]); return '(?:/(.*))?'; }
      const one = part.match(/^:(\w+)$/);
      if (one) { names.push(one[1]); return '([^/]+)'; }
      return part.replace(/[.+?^${}()|[\]\\*]/g, '\\$&');
    })
    .join('');
  return { re: new RegExp(`^${re}$`), names };
}

/* A redirect matcher for a vercel.json-shaped config: (url) => { status, location } | null. */
export function redirectsOf(config) {
  const rules = (config.redirects ?? []).map((r) => ({ ...r, ...compile(r.source) }));
  return (input) => match(rules, typeof input === 'string' ? new URL(input, SITE) : input);
}

function match(rules, url) {
  for (const r of rules) {
    const m = url.pathname.match(r.re);
    if (!m) continue;
    const ok = (r.has ?? []).every((h) => {
      if (h.type !== 'query') return false;
      const v = url.searchParams.get(h.key);
      if (v === null) return false;
      return h.value === undefined || new RegExp(`^(?:${h.value})$`).test(v);
    });
    if (!ok) continue;
    let dest = r.destination;
    r.names.forEach((n, i) => { dest = dest.replace(new RegExp(`:${n}\\*?`), m[i + 1] ?? ''); });
    const to = new URL(dest, SITE);
    for (const [k, v] of url.searchParams) if (!to.searchParams.has(k)) to.searchParams.append(k, v);
    return { status: r.statusCode ?? (r.permanent === false ? 307 : 308), location: to.pathname + to.search };
  }
  return null;
}

/* The redirect a URL takes on Vercel with this repo's vercel.json, or null. */
export const redirectFor = redirectsOf(vercel);

/* The file out/ serves for a path, or null (Vercel then answers with 404.html). */
export function fileFor(out, pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return null; }
  const f = path.join(out, p);
  if (f !== out && !f.startsWith(out + path.sep)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  const idx = path.join(f, 'index.html');
  return fs.existsSync(idx) ? idx : null;
}

/* What Vercel answers for a URL: { kind: 'redirect', status, location } | { kind: 'file', file } | { kind: '404' }. */
export function resolve(out, input, redirect = redirectFor) {
  const url = typeof input === 'string' ? new URL(input, SITE) : input;
  const r = redirect(url);
  if (r) return { kind: 'redirect', ...r };
  const file = fileFor(out, url.pathname);
  return file ? { kind: 'file', file } : { kind: '404' };
}
