/* The site theme control: one icon button, the View Transition circle wipe,
   and a remembered choice. Loaded in <head> so the stored theme lands before
   first paint. Every page carries <button id="themeflip"> in its topbar. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  try {
    if (localStorage.getItem('verseva-theme') === 'light') root.dataset.theme = 'light';
  } catch (e) {}

  const SUN = '<svg class="ticon tsun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"/></svg>';
  const MOON = '<svg class="ticon tmoon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.4 14.2A8.4 8.4 0 0 1 9.8 3.6a8.4 8.4 0 1 0 10.6 10.6Z"/></svg>';

  let btn = null;
  const label = () => {
    if (btn) btn.setAttribute('aria-label', root.dataset.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  };
  const flip = () => {
    root.dataset.theme = root.dataset.theme === 'light' ? '' : 'light';
    try { localStorage.setItem('verseva-theme', root.dataset.theme); } catch (e) {}
    label();
  };
  const wipe = (e) => {
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || rm) return flip();
    const x = e.clientX || innerWidth / 2;
    const y = e.clientY || 40;
    const t = document.startViewTransition(flip);
    t.ready.then(() => {
      const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      document.documentElement.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${far}px at ${x}px ${y}px)`] },
        { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  };
  window.versevaThemeWipe = wipe;

  const init = () => {
    btn = document.getElementById('themeflip');
    if (!btn) return;
    btn.classList.add('icon');
    btn.innerHTML = SUN + MOON;
    label();
    btn.addEventListener('click', wipe);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init);
  else init();
})();
