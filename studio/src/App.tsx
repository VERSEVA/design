import { useEffect, useRef } from 'react';
import { StudioHeader } from './shell/StudioHeader';
import { StudioSelect, StudioSidebar } from './shell/StudioSidebar';
import { routeFor } from './shell/routes';
import { scrollToHash, usePath } from './shell/router';
import { useStickyOffset } from './shell/stickyOffset';

function setDescription(content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
  meta.content = content;
}

export function App() {
  const path = usePath();
  const route = routeFor(path);
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  useStickyOffset();
  /* Cold deep link: after every child effect (chapter scripts) and the sticky offset. */
  useEffect(() => { scrollToHash(); }, []);

  useEffect(() => {
    document.title = route.title;
    setDescription(route.description);
    if (first.current) { first.current = false; return; }
    const h1 = main.current?.querySelector('h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  }, [route]);

  const { Page } = route;
  return (
    <div className="studio">
      <StudioHeader showPicker={route.path !== '/'} />
      <StudioSelect path={route.path} />
      <div className="studio-body">
        <StudioSidebar path={route.path} />
        <main ref={main} className="studio-main" id="main"><Page /></main>
      </div>
    </div>
  );
}
