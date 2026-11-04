// A ported chapter: the legacy page's body as studio markup, inside the same
// stage the iframe used, so the shell, anchors and theme behave as on native
// studio pages. Render-safe: nothing here touches window or storage until mount.
import { useEffect, useRef, type ReactNode } from 'react';
import './chapters.css';
import './native.css';

/* A chapter's inline script, ported: runs after mount against the chapter root.
   Listeners take the signal, timers register with onCleanup, so a remount
   (route change, StrictMode) leaves nothing behind. */
export type ChapterScript = (root: HTMLElement, signal: AbortSignal, onCleanup: (fn: () => void) => void) => void;

export function NativeChapter({ slug, script, children }: { slug: string; script?: ChapterScript; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || !script) return;
    const ac = new AbortController();
    const cleanups: Array<() => void> = [];
    script(el, ac.signal, (fn) => cleanups.push(fn));
    return () => { ac.abort(); cleanups.forEach((fn) => fn()); };
  }, [script]);
  return (
    <section className="chapter" data-chapter={slug}>
      <div className="chapter-stage">
        <div ref={root} className="chap">{children}</div>
      </div>
    </section>
  );
}
