import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { syncFrame, watchFrames } from '../src/front/frameSync';
import { applyTheme } from '../src/theme';

function frame() {
  const f = document.createElement('iframe');
  document.body.appendChild(f);
  return f;
}

describe('frame sync', () => {
  beforeEach(() => { document.body.innerHTML = ''; applyTheme({ brand: '', mode: 'dark' }); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('injects the four absolute theme links once per frame', () => {
    const f = frame();
    syncFrame(f);
    const hrefs = () => [...f.contentDocument!.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'));
    expect(hrefs()).toEqual(['/themes/cobalt.css', '/themes/forest.css', '/themes/slate.css', '/themes/violet.css']);
    syncFrame(f);
    expect(hrefs()).toHaveLength(4);
  });

  it('mirrors brand and mode onto the frame document', () => {
    const f = frame();
    applyTheme({ brand: 'forest', mode: 'light' });
    syncFrame(f);
    const el = f.contentDocument!.documentElement;
    expect(el.dataset.brand).toBe('forest');
    expect(el.dataset.theme).toBe('light');
  });

  it('follows vsv-theme until stopped', () => {
    const f = frame();
    const stop = watchFrames(document.body);
    applyTheme({ brand: 'violet', mode: 'dark' });
    const el = f.contentDocument!.documentElement;
    expect(el.dataset.brand).toBe('violet');
    expect(el.dataset.theme).toBeUndefined();
    stop();
    applyTheme({ brand: 'slate', mode: 'dark' });
    expect(el.dataset.brand).toBe('violet');
  });
});
