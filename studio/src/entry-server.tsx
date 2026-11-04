// The pre-render entry (vite build --ssr): every live route to HTML, with its own head.
// scripts/prerender.mjs writes each document to dist/<route>/index.html.
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App';
import { setServerPath } from './shell/router';
import { LIVE_ROUTES } from './shell/routes-table';
import { headFor } from './shell/head';

export const PRERENDER_PATHS: ReadonlyArray<string> = LIVE_ROUTES.map((r) => r.path);

export function renderApp(path: string): string {
  setServerPath(path);
  return renderToString(<StrictMode><App /></StrictMode>);
}

const HEAD_RE = /<title>[^<]*<\/title>\s*<meta name="description" content="[^"]*">/;
const ROOT = '<div id="studio-root"></div>';

/** The template (index.html, source or built) with this route's head and pre-rendered root. */
export function renderDocument(template: string, path: string): string {
  if (!HEAD_RE.test(template)) throw new Error('prerender: template has no <title> + description pair');
  if (!template.includes(ROOT)) throw new Error(`prerender: template has no ${ROOT}`);
  const attr = path.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return template
    .replace(HEAD_RE, () => headFor(path))
    .replace(ROOT, () => `<div id="studio-root" data-path="${attr}">${renderApp(path)}</div>`);
}
