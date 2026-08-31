import * as React from 'react';
import { cx } from './cx';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Footer actions; Cancel never sits primary. */
  footer?: React.ReactNode;
  className?: string;
}

/** Modal at --r-lg (law 7). Escape and overlay-click close; focus moves in on open. */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ovl open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cx('modal', className)} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="bd">
          <h4>{title}</h4>
          {children}
        </div>
        {footer && <div className="ft">{footer}</div>}
      </div>
    </div>
  );
}

/* The overlay is the consumer's, at class level:
   .ovl { position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
          background: color-mix(in srgb, var(--text-1) 18%, transparent); z-index: 9; padding: var(--s-5); }
   .ovl.open { display: flex; } */
