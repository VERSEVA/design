'use client';
import * as React from 'react';
import { cx } from './cx';
import { Badge } from './badge';
import { Button } from './button';
import { SECRET_FIELD_LABELS, type SecretFieldLabels } from './secret-field-labels';

export interface SecretFieldProps {
  label: string;
  /** Whether a value is stored. The part never receives the value itself, by any prop. */
  isSet: boolean;
  /** Stores the typed value. Resolve when it is stored; reject (or throw) when it is not. */
  onSave: (value: string) => Promise<unknown>;
  labels?: Partial<SecretFieldLabels>;
  /** Left off unless given: a named password input invites the browser to keep it. */
  name?: string;
  id?: string;
  className?: string;
}

const CHECK = (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

/* Reads the value and hands it over in one frame, so no closure of the part keeps it. */
function send(input: HTMLInputElement, onSave: SecretFieldProps['onSave']): Promise<unknown> {
  try {
    return Promise.resolve(onSave(input.value));
  } catch {
    return Promise.reject();
  }
}

/**
 * A field for keys and tokens: written, never read back. Unset, it is an empty input with Save.
 * Set, it is a badge and a Replace action; Replace opens an empty input in the same spot with
 * Save and Cancel. The typed value lives in the input element alone: it is not in state, not in
 * a ref, not in an attribute, and the input is cleared and unmounted when the save lands. A
 * failed save leaves the value in the input for a retry. The error text comes from the labels,
 * never from the rejection, which may carry the value.
 */
export function SecretField({ label, isSet, onSave, labels, name, id, className }: SecretFieldProps) {
  const L = { ...SECRET_FIELD_LABELS, ...labels };
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const labelId = `${inputId}-l`;
  const errorId = `${inputId}-e`;

  /* True from a landed save until the host's isSet catches up, so Set shows at once. */
  const [saved, setSaved] = React.useState(false);
  const [seen, setSeen] = React.useState(isSet);
  const [replacing, setReplacing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /* Whether the input has anything in it: a boolean, never the value. */
  const [filled, setFilled] = React.useState(false);
  const [said, setSaid] = React.useState('');
  const [lock, setLock] = React.useState<number | undefined>(undefined);
  if (seen !== isSet) {
    setSeen(isSet);
    setSaved(false);
    /* A value stored from elsewhere does not take what the user is typing: edit mode holds. */
    if (isSet && filled) setReplacing(true);
  }

  const focusNext = React.useRef<'input' | 'replace' | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  /* Whenever the input leaves the page (saved, cancelled, unmounted) it leaves empty, the
     has-text flag and the error go with it, and focus it was holding goes to Replace. */
  const attachInput = React.useCallback((node: HTMLInputElement | null) => {
    const gone = node ? null : inputRef.current;
    if (gone) {
      if (document.activeElement === gone) focusNext.current = 'replace';
      gone.value = '';
      setFilled(false);
      setError(null);
    }
    inputRef.current = node;
  }, []);
  const saveRef = React.useRef<HTMLButtonElement>(null);
  const replaceRef = React.useRef<HTMLButtonElement>(null);
  const mounted = React.useRef(false);

  const stored = isSet || saved;
  const editing = !stored || replacing;

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* Focus follows the state change it belongs to, once the target exists and can take it. */
  React.useEffect(() => {
    const target = focusNext.current === 'replace' ? replaceRef.current : focusNext.current === 'input' ? inputRef.current : null;
    if (!target || target.disabled) return;
    focusNext.current = null;
    target.focus();
  });

  const leaveEdit = () => {
    if (inputRef.current) inputRef.current.value = '';
    setFilled(false);
    setError(null);
    setReplacing(false);
    focusNext.current = 'replace';
  };

  const save = () => {
    const input = inputRef.current;
    if (busy || !input) return;
    if (!input.value) {
      input.focus();
      return;
    }
    /* Width locked on the label it had; focus moves to Save before the input is disabled. */
    setLock(saveRef.current?.offsetWidth || undefined);
    saveRef.current?.focus();
    /* Edit mode is held for the whole save, whatever the host does to isSet meanwhile. */
    setReplacing(true);
    setBusy(true);
    setError(null);
    setSaid('');
    send(input, onSave).then(
      () => {
        input.value = '';
        if (!mounted.current) return;
        setBusy(false);
        setLock(undefined);
        setSaved(true);
        leaveEdit();
        setSaid(L.saved);
      },
      () => {
        if (!mounted.current) return;
        setBusy(false);
        setLock(undefined);
        /* A message that repeats the typed value is not shown. */
        setError(input.value && L.error.includes(input.value) ? SECRET_FIELD_LABELS.error : L.error);
        focusNext.current = 'input';
      },
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape' && stored && !busy) {
      e.preventDefault();
      leaveEdit();
    }
  };

  return (
    <div className={cx('field', editing && error !== null && 'error', className)}>
      <div className="chiprow">
        <label htmlFor={editing ? inputId : undefined} id={labelId}>{label}</label>
        {stored && <Badge tone="neutral">{CHECK}{L.set}</Badge>}
      </div>
      {editing && (
        <input
          ref={attachInput}
          id={inputId}
          name={name}
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={busy}
          aria-invalid={error !== null || undefined}
          aria-describedby={error !== null ? errorId : undefined}
          onChange={(e) => setFilled(e.currentTarget.value !== '')}
          onKeyDown={onKeyDown}
        />
      )}
      {editing && error !== null && <p className="help" id={errorId} role="alert">{error}</p>}
      {editing ? (
        <div className="chiprow">
          {stored && <Button variant="ghost" size="sm" disabled={busy} onClick={leaveEdit}>{L.cancel}</Button>}
          <Button ref={saveRef} size="sm" disabled={!busy && !filled} aria-busy={busy || undefined} style={busy && lock ? { width: lock } : undefined} onClick={save}>
            {busy ? <><span className="spinner" aria-hidden="true" /><span className="sr-only">{L.saving}</span></> : L.save}
          </Button>
        </div>
      ) : (
        <div className="chiprow">
          <Button
            ref={replaceRef}
            variant="secondary"
            size="sm"
            aria-describedby={labelId}
            onClick={() => {
              setSaid('');
              setReplacing(true);
              focusNext.current = 'input';
            }}
          >
            {L.replace}
          </Button>
        </div>
      )}
      <span className="sr-only" role="status">{said}</span>
    </div>
  );
}
