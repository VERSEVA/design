// The inline head script runs before any stylesheet: it puts the stored mode, brand, custom
// accent, sidebar rail and shut nav groups on <html>, so the first paint is already right.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { deriveAccent, styleText, CUSTOM_KEY } from '../src/shell/accent';
import { RAIL_KEY, SHUT_KEY } from '../src/shell/nav';

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const script = new DOMParser().parseFromString(html, 'text/html').querySelector('head script:not([src])')!.textContent!;
const run = () => new Function(script)();
const root = document.documentElement;

afterEach(() => {
  localStorage.clear();
  for (const k of ['mode', 'theme', 'brand', 'rail', 'navShut']) delete root.dataset[k];
  document.getElementById('vsv-custom')?.remove();
});

describe('head script', () => {
  it('applies a stored custom accent before first paint, with the runtime style text', () => {
    const d = deriveAccent('#7c3aed');
    localStorage.setItem('verseva-brand', 'custom');
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ pick: d.pick, dark: d.dark, light: d.light }));
    run();
    expect(root.dataset.brand).toBe('custom');
    expect(document.getElementById('vsv-custom')!.textContent).toBe(styleText({ dark: d.dark, light: d.light }));
    /* the style lands before the stylesheets, so it must out-rank tokens.css (:root, [data-theme="light"]) */
    const style = document.getElementById('vsv-custom')!;
    expect(style.textContent).toMatch(/^:root\[data-brand="custom"\]\{[^}]+\}:root\[data-brand="custom"\]\[data-theme="light"\]\{/);
  });

  it('refuses a stored custom value that is not a six digit hex, and falls back to the signature', () => {
    localStorage.setItem('verseva-brand', 'custom');
    const evil = { accent: 'red;}body{display:none', hover: '#000000', ink: '#000000' };
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ pick: '#000000', dark: evil, light: evil }));
    run();
    expect(root.dataset.brand).toBeUndefined();
    expect(document.getElementById('vsv-custom')).toBeNull();
  });

  it('survives junk JSON', () => {
    localStorage.setItem('verseva-brand', 'custom');
    localStorage.setItem(CUSTOM_KEY, '{nope');
    run();
    expect(root.dataset.brand).toBeUndefined();
    expect(root.dataset.mode).toBe('system');
  });

  it('records the collapsed rail and the shut nav groups', () => {
    localStorage.setItem(RAIL_KEY, '1');
    localStorage.setItem(SHUT_KEY, JSON.stringify(['chapters', 'x y', 'gallery']));
    run();
    expect(root.dataset.rail).toBe('collapsed');
    expect(root.dataset.navShut).toBe('chapters gallery');
  });

  it('leaves the rail expanded by default', () => {
    run();
    expect(root.dataset.rail).toBeUndefined();
    expect(root.dataset.navShut ?? '').toBe('');
  });
});
