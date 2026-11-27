/* verseva board, in the browser: the brand switcher. Picking a theme points one stylesheet at
   /theme/<id>.css and sets <html data-brand="<id>">; Baseline removes both. ?brand=<id> opens a
   theme directly; an id the menu does not list falls back to Baseline. Open, close and the
   outside click come from the specimen page's own .menu wiring; this adds the pick, Escape,
   and arrow keys between items. */
(() => {
  const root = document.documentElement;
  const button = document.getElementById('board-current');
  const list = document.getElementById('board-themes');
  if (!button || !list) return;
  const items = [...list.querySelectorAll('[data-board-theme]')];
  let link = document.getElementById('board-theme');

  const apply = (id) => {
    const item = items.find((i) => i.dataset.boardTheme === id) || items[0];
    const theme = item.dataset.boardTheme;
    /* a fresh link per switch: the old sheet goes with its element */
    const next = document.createElement('link');
    next.rel = 'stylesheet';
    next.id = 'board-theme';
    if (theme) next.href = `/theme/${theme}.css`;
    link.replaceWith(next);
    link = next;
    if (theme) root.dataset.brand = theme; else delete root.dataset.brand;
    items.forEach((i) => i.setAttribute('aria-checked', String(i === item)));
    button.textContent = item.textContent;
    const url = new URL(location.href);
    if (theme) url.searchParams.set('brand', theme); else url.searchParams.delete('brand');
    history.replaceState(null, '', url);
  };

  const open = () => {
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    (items.find((i) => i.getAttribute('aria-checked') === 'true') || items[0]).focus();
  };
  const close = (refocus) => {
    if (list.hidden) return;
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  };

  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); open(); }
  });
  items.forEach((item, ix) => {
    item.addEventListener('click', () => { apply(item.dataset.boardTheme); close(true); });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        items[(ix + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      }
    });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(true); });

  apply(new URLSearchParams(location.search).get('brand') || '');
})();
