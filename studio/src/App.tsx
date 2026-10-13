import { useEffect, useRef } from 'react';
import { StudioHeader } from './shell/StudioHeader';
import { StudioSelect, StudioSidebar } from './shell/StudioSidebar';
import { routeFor } from './shell/routes';
import { usePath } from './shell/router';

export function App() {
  const path = usePath();
  const route = routeFor(path);
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  useEffect(() => {
    document.title = route.path === '/' ? 'VERSEVA Design' : `${route.title} · VERSEVA Design`;
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
