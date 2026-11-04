// The law 3 accent counter shared by the served tests (home.test.mjs, chapters.test.mjs): every
// painted use of the accent on the page, grouped, as a JSON list of strings.
const sleep = 'const sleep = (ms) => new Promise((r) => setTimeout(r, ms));';

/* Every painted use of the accent, grouped: the focus widget counts once, a control counts once
   (its icon and label are one use), and the rest by element. The color popover's swatch shows
   the picked value (it is the picker's data, not spend) and is skipped, as are :focus-visible rings (the --focus role). */
export const ACCENT = (open = false) => `(async () => {
  ${sleep}
  await sleep(1500);
  if (${open}) {
    const cap = document.querySelector('.hero-live button.lact');
    cap.focus();
    cap.click();
    await sleep(300);
    if (document.querySelector('.hero-live .lact-panel')?.hidden !== false) return JSON.stringify(['panel did not open']);
  }
  document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  await sleep(200);
  const probe = document.createElement('i');
  probe.style.color = 'var(--accent)';
  document.body.appendChild(probe);
  const acc = getComputedStyle(probe).color.match(/[\\d.]+/g).slice(0, 3).map(Number);
  probe.remove();
  const triples = (s) => {
    const out = [];
    for (const m of s.matchAll(/rgba?\\(([^)]*)\\)/g)) out.push(m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 4).map(Number));
    for (const m of s.matchAll(/color\\(srgb ([^)]*)\\)/g)) { const v = m[1].split(/[ /]+/).filter(Boolean).map(Number); out.push([v[0] * 255, v[1] * 255, v[2] * 255, v[3] ?? 1]); }
    return out;
  };
  const isAcc = (s) => !!s && triples(s).some((t) => (t[3] === undefined || t[3] > 0.02) && t.slice(0, 3).every((v, i) => Math.abs(v - acc[i]) <= 1.5));
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const name = (el) => {
    const c = el.closest('a,button') || el;
    const label = (c.getAttribute('aria-label') || c.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    return c.tagName.toLowerCase() + (c.className && typeof c.className === 'string' ? '.' + c.className.trim().split(/\\s+/).join('.') : '') + ' "' + label + '"';
  };
  const uses = new Set();
  const root = document.getElementById('studio-root');
  for (const el of root.querySelectorAll('*')) {
    if (!shown(el) || el.closest('.accentswatch')) continue;
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
      /* A focus ring is the --focus role, not accent spend (the contract's 2px --focus): skip it. */
      const ring = !pseudo && el.matches(':focus-visible');
      const vals = [cs.backgroundColor, cs.backgroundImage];
      if (!ring) vals.push(cs.boxShadow);
      if (!pseudo && ownText(el)) vals.push(cs.color);
      if (el instanceof SVGElement) vals.push(cs.fill, cs.stroke);
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs['border' + side + 'Width']) > 0) vals.push(cs['border' + side + 'Color']);
      if (!ring && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) vals.push(cs.outlineColor);
      if (!vals.some(isAcc)) continue;
      const focus = el.closest('.wtile[data-focus]');
      uses.add(focus ? 'focus widget ' + (focus.getAttribute('data-id') || focus.id) : (el.closest('.studio-main') ? 'main ' : 'shell ') + name(el));
    }
  }
  return JSON.stringify([...uses].sort());
})()`;

