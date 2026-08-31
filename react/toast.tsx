import * as React from 'react';

export interface ToastItem {
  id: number;
  text: string;
  tone: 'ok' | 'err';
}

const ToastContext = React.createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {});

/** One toast at a time, bottom-right, gone in ~2.4s. The word does the work; the dot just nods. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<ToastItem | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();

  const show = React.useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="toastwrap" role="status" aria-live="polite">
          <div className={`toast ${toast.tone}`}>
            <span className="dot" aria-hidden="true" />
            {toast.text}
            <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}>×</button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

/** const toast = useToast(); toast('Quote issued.'); toast('Blocked: ruling open.', 'err'); */
export function useToast() {
  return React.useContext(ToastContext);
}

/* Position the wrap once, at class level (seam law):
   .toastwrap { position: fixed; right: var(--s-5); bottom: var(--s-5); z-index: 9; } */
