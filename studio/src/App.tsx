import { useEffect, useRef } from 'react';
import { StudioHeader } from './shell/StudioHeader';
import { StudioSelect, StudioSidebar } from './shell/StudioSidebar';
import { NOT_FOUND, routeFor } from './shell/routes';
import { dropStrayF, focusTarget, scrollToHash, usePath } from './shell/router';
import { useStickyOffset } from './shell/stickyOffset';
import { applyHead } from './shell/head';
import { PageToc, hasToc } from './shell/PageToc';

/* WCAG 2.4.1: the first focusable element of the shell. Without JS the #main fragment still
   jumps; with it, focus moves to <main> and the URL keeps its own hash. */
function onSkip(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  focusTarget(document.getElementById('main'));
}

export function App() {
  const path = usePath();
  const route = routeFor(path);
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  useStickyOffset();
  /* Cold deep link: after every child effect (chapter scripts) and the sticky offset. */
  useEffect(() => { dropStrayF(); scrollToHash(); }, []);

  useEffect(() => {
    applyHead(document, route === NOT_FOUND ? null : route.path);
    if (first.current) { first.current = false; return; }
    /* A hash navigation (command bar, On this page) lands focus on its section instead. */
    if (window.location.hash) return;
    const h1 = main.current?.querySelector('h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  }, [route]);

  const { Page } = route;
  const toc = hasToc(route);
  return (
    <div className="studio">
      <a className="studio-skip" href="#main" onClick={onSkip}>Skip to content</a>
      <StudioHeader />
      <StudioSelect path={route.path} />
      <div className={`studio-body${toc ? ' has-toc' : ''}`}>
        <StudioSidebar path={route.path} />
        <main ref={main} className="studio-main" id="main"><Page /></main>
        {toc && <PageToc key={route.path} route={route} />}
      </div>
    </div>
  );
}
