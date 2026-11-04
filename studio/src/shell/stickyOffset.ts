// Writes the sticky chrome's real heights to the root (--studio-head-h, --studio-select-h)
// so every scroll margin (--studio-scroll-pad in studio.css) clears it at any width,
// including a header that wraps to three rows on a phone.
import { useLayoutEffect } from 'react';

export function useStickyOffset() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const head = document.querySelector<HTMLElement>('.studio-head');
    const select = document.querySelector<HTMLElement>('.studio-select');
    const write = () => {
      if (head) root.style.setProperty('--studio-head-h', `${Math.ceil(head.getBoundingClientRect().height)}px`);
      if (select) root.style.setProperty('--studio-select-h', `${Math.ceil(select.getBoundingClientRect().height)}px`);
    };
    write();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(write);
    for (const el of [head, select]) if (el) ro.observe(el);
    return () => ro.disconnect();
  }, []);
}
