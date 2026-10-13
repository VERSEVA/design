// Library detail surface: .modal on desktop, .sheet on phone. Traps focus, closes on Escape,
// returns focus to the opener.
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const PHONE = '(max-width: 760px)';
export function useMedia(q: string): boolean {
  return useSyncExternalStore(
    (l) => { const m = window.matchMedia(q); m.addEventListener?.('change', l); return () => m.removeEventListener?.('change', l); },
    () => window.matchMedia(q).matches,
    () => false,
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

export interface DialogProps { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }

export function Dialog({ title, onClose, children, footer, size = 'md' }: DialogProps) {
  const phone = useMedia(PHONE);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => { opener?.focus?.(); };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const list = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0], last = list[list.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === e.currentTarget)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  };

  return createPortal(
    <div className={`ovl open lib-ovl${phone ? ' is-phone' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        className={`${phone ? 'sheet' : 'modal'} lib-dialog lib-dialog-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {phone && <div className="grab" aria-hidden="true" />}
        <div className="bd">
          <div className="lib-dhead">
            <h4>{title}</h4>
            <button type="button" className="btn btn-ghost icon sm" aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
            </button>
          </div>
          {children}
        </div>
        {footer && <div className="ft">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
