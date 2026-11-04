import * as React from 'react';
import { buildSections, firstSelectable, isAsyncIterable, moveSelection, resultCount } from './command-state';
import type { BarOption } from './command-state';
import { isSearchShortcut, shortcutLabel, withDefaults } from './console-state';
import { cx } from './cx';

export interface Command {
  /** Group heading; groups show in the order they first appear. */
  group: string;
  label: string;
  icon?: React.ReactNode;
  /** Trailing hint, e.g. a key sequence "G I". */
  hint?: React.ReactNode;
  /** Extra words that match. */
  keywords?: string[];
  disabled?: boolean;
  /** Runs after the bar closes and focus is back on the trigger. */
  run: () => void;
}

export interface AskAnswer {
  text: string;
  /** A preview shown under the answer, e.g. a widget at its M size. */
  widget?: React.ReactNode;
}

/** Streamed tokens; a `widget` on the iterable shows under the answer once the stream ends. */
export type AskStream = AsyncIterable<string> & { widget?: React.ReactNode };

/** Stream tokens, or return the whole answer (directly or as a promise). */
export type AskResult = AskStream | AskAnswer;

export interface CommandBarProps {
  commands: Command[];
  /** Without it there is no Ask row: unmatched queries show the no-results state. */
  onAsk?: (question: string, ctx: { signal: AbortSignal }) => AskResult | Promise<AskResult>;
  /** Shows "Pin to Home" under an answer that carries a widget. */
  onPin?: (answer: { question: string; text: string; widget: React.ReactNode }) => void;
  /** Controlled open state; leave undefined to let the bar own it. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Default true: Meta+K / Ctrl+K opens and closes the bar. */
  shortcut?: boolean;
  /** Built-in words; English defaults in COMMAND_BAR_LABELS. */
  labels?: Partial<CommandBarLabels>;
  className?: string;
}

export const COMMAND_BAR_LABELS = {
  dialog: 'Command bar',
  input: 'Search, run, or ask',
  placeholder: 'Search, run, or ask',
  results: 'Commands',
  count: (n: number) => (n === 1 ? '1 result' : `${n} results`),
  ask: (q: string) => `Ask “${q}”`,
  askMode: 'Ask',
  noResults: 'No results',
  answer: 'Answer',
  thinking: 'Thinking',
  askFailed: 'The answer did not load.',
  retry: 'Retry',
  pin: 'Pin to Home',
  again: 'Ask another',
  move: 'move',
  run: 'run',
  askKey: 'ask',
  close: 'close',
  closeButton: 'Close',
};
export type CommandBarLabels = typeof COMMAND_BAR_LABELS;

type AskStatus = 'loading' | 'streaming' | 'done' | 'error';
interface AskState { question: string; text: string; widget?: React.ReactNode; status: AskStatus }

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const SEARCH = icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
const SPARKLE = icon(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />);
const CLOSE = icon(<path d="M18 6 6 18M6 6l12 12" />);
const ALERT = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>);
const FOCUSABLE = 'input:not([disabled]),button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || '');
}

/** IME composition (CJK, dictation): keys belong to the composer, not the bar. */
function composing(e: React.KeyboardEvent): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}

/** Another aria-modal dialog is open (not this bar): the shortcut stands down. */
function otherModalOpen(self: Element | null): boolean {
  if (typeof document === 'undefined') return false;
  return [...document.querySelectorAll('[aria-modal="true"]:not([hidden])')].some((el) => el !== self);
}

export interface CommandBarTriggerProps {
  onOpen: () => void;
  /** Visible text; also the accessible name. Default "Search or ask". */
  label?: string;
  /** Default true: shows the K chord. */
  shortcut?: boolean;
  disabled?: boolean;
  className?: string;
}

/** The top bar's search slot as a button that opens the bar. The kbd label settles after mount (SSR-stable). */
export function CommandBarTrigger({ onOpen, label = 'Search or ask', shortcut = true, disabled, className }: CommandBarTriggerProps) {
  const [apple, setApple] = React.useState(false);
  React.useEffect(() => { setApple(isApplePlatform()); }, []);
  return (
    <button
      type="button"
      className={cx('searchbox', 'cmdk-trigger', className)}
      aria-haspopup="dialog"
      aria-keyshortcuts={shortcut ? 'Meta+K Control+K' : undefined}
      disabled={disabled}
      onClick={(e) => { e.currentTarget.focus(); onOpen(); }}
    >
      {SEARCH}
      <span>{label}</span>
      {shortcut && <kbd aria-hidden="true">{shortcutLabel(apple)}</kbd>}
    </button>
  );
}

/**
 * Command bar: actions, go-to and recent items filtered as you type, and an
 * Ask row (only with onAsk) whose answer streams in place. A modal dialog with
 * a combobox over a grouped listbox; Tab and Shift+Tab stay inside; Escape or
 * a scrim click closes and focus returns to what opened it.
 */
export function CommandBar({
  commands, onAsk, onPin, open, defaultOpen = false, onOpenChange, shortcut = true, labels, className,
}: CommandBarProps) {
  const L = withDefaults(COMMAND_BAR_LABELS, labels);
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen);
  const isOpen = open ?? innerOpen;
  const [query, setQuery] = React.useState('');
  const [forced, setForced] = React.useState(false);
  const [ask, setAsk] = React.useState<AskState | null>(null);
  const [selState, setSelState] = React.useState({ key: '', i: -1 });
  const baseId = React.useId();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const returnTo = React.useRef<HTMLElement | null>(null);
  const runId = React.useRef(0);
  const abort = React.useRef<AbortController | null>(null);

  const result = React.useMemo(() => buildSections(commands, query, { canAsk: Boolean(onAsk), forced }), [commands, query, onAsk, forced]);
  const { options } = result;
  const key = `${forced ? 1 : 0}:${query}`;
  const sel = selState.key === key && selState.i >= 0 && selState.i < options.length && !options[selState.i].disabled
    ? selState.i
    : firstSelectable(options);
  const select = (i: number) => setSelState({ key, i });
  const optId = (i: number) => `${baseId}-o${i}`;

  const cancelAsk = () => {
    runId.current++;
    abort.current?.abort();
    abort.current = null;
  };

  const setOpen = React.useCallback((v: boolean) => {
    if (open === undefined) setInnerOpen(v);
    onOpenChange?.(v);
  }, [open, onOpenChange]);

  const restoreFocus = () => {
    const el = returnTo.current;
    if (el && el.isConnected) el.focus();
  };

  const close = () => {
    cancelAsk();
    restoreFocus();
    setOpen(false);
  };

  // Open: remember what had focus, start clean, focus the field. Closed from outside: put focus back if it fell to the page.
  React.useEffect(() => {
    if (!isOpen) {
      const a = typeof document !== 'undefined' ? document.activeElement : null;
      if (!a || a === document.body) restoreFocus();
      return;
    }
    const a = document.activeElement;
    returnTo.current = a instanceof HTMLElement && a !== document.body ? a : null;
    setQuery('');
    setForced(false);
    setAsk(null);
    inputRef.current?.focus();
    return cancelAsk;
  }, [isOpen]);

  // Meta+K / Ctrl+K toggles, also while typing elsewhere; stands down under another modal.
  React.useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e)) return;
      if (isOpen) { e.preventDefault(); close(); return; }
      if (otherModalOpen(null)) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Keep the active option in view.
  React.useEffect(() => {
    if (sel < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [sel, isOpen]);

  const startAsk = async (question: string) => {
    if (!onAsk) return;
    cancelAsk();
    const id = runId.current;
    const ac = new AbortController();
    abort.current = ac;
    setAsk({ question, text: '', status: 'loading' });
    try {
      const r = await onAsk(question, { signal: ac.signal });
      if (id !== runId.current) return;
      if (isAsyncIterable(r)) {
        let text = '';
        for await (const chunk of r) {
          if (id !== runId.current) return;
          text += String(chunk);
          setAsk({ question, text, status: 'streaming' });
        }
        if (id !== runId.current) return;
        setAsk({ question, text, widget: (r as AskStream).widget, status: 'done' });
      } else if (r && typeof r === 'object' && typeof r.text === 'string') {
        setAsk({ question, text: r.text, widget: r.widget, status: 'done' });
      } else {
        throw new TypeError('onAsk returned neither an async iterable nor { text }');
      }
    } catch {
      if (id === runId.current) setAsk({ question, text: '', status: 'error' });
    }
  };

  const runOption = (o: BarOption<Command> | undefined) => {
    if (!o || o.disabled) return;
    if (o.kind === 'ask') { void startAsk(o.question); return; }
    close();
    o.command.run();
  };

  const backToList = (q: string) => {
    cancelAsk();
    setAsk(null);
    setForced(false);
    setQuery(q);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  const canAsk = Boolean(onAsk);
  const asking = ask !== null;
  const busy = ask?.status === 'loading' || ask?.status === 'streaming';
  const status = asking
    ? (ask.status === 'done' ? ask.text : '')
    : (query.trim() ? L.count(resultCount(result)) : '');

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (composing(e)) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    if (e.target === inputRef.current && !e.shiftKey && !asking && canAsk && query.trim() && !forced) {
      e.preventDefault();
      setForced(true);
      return;
    }
    const list = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (composing(e)) return;
    if (asking) {
      if (e.key === 'Enter' && ask.status === 'error') { e.preventDefault(); void startAsk(ask.question); }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = moveSelection(sel, e.key === 'ArrowDown' ? 1 : -1, options);
      if (next >= 0) select(next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runOption(options[sel]);
    }
  };

  return (
    <div className="cmdk-ovl" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div
        ref={dialogRef}
        className={cx('cmdk', className)}
        role="dialog"
        aria-modal="true"
        aria-label={L.dialog}
        onKeyDown={onKeyDown}
      >
        <div className="cmdk-field">
          {SEARCH}
          <input
            ref={inputRef}
            className="cmdk-input"
            type="text"
            role="combobox"
            aria-label={L.input}
            aria-expanded={!asking && options.length > 0}
            aria-controls={`${baseId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={!asking && sel >= 0 ? optId(sel) : undefined}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={L.placeholder}
            value={query}
            onChange={(e) => backToList(e.target.value)}
            onKeyDown={onInputKey}
          />
          {result.asking && !asking && <span className="cmdk-mode" aria-hidden="true">{L.askMode}</span>}
          <kbd className="cmdk-kbd" aria-hidden="true">esc</kbd>
          <button type="button" className="ibtn cmdk-close" aria-label={L.closeButton} onClick={close}>{CLOSE}</button>
        </div>

        <span className="sr-only" role="status">{status}</span>

        {!asking && (options.length ? (
          <ul className="cmdk-list" id={`${baseId}-list`} role="listbox" aria-label={L.results} ref={listRef}>
            {result.sections.map((s, si) => (
              <li role="presentation" key={`${si}:${s.group}`}>
                <div className="cmdk-group" id={`${baseId}-g${si}`}>{s.group}</div>
                <ul role="group" aria-labelledby={`${baseId}-g${si}`}>
                  {s.options.map((o) => (
                    <li
                      key={o.index}
                      id={optId(o.index)}
                      data-i={o.index}
                      role="option"
                      aria-selected={o.index === sel}
                      aria-disabled={o.disabled || undefined}
                      className={cx('cmdk-opt', o.kind === 'ask' && 'ask')}
                      onMouseDown={(e) => e.preventDefault()}
                      onPointerMove={() => { if (!o.disabled && o.index !== sel) select(o.index); }}
                      onClick={() => runOption(o)}
                    >
                      {o.kind === 'ask' ? SPARKLE : (o.command.icon ?? SEARCH)}
                      <span className="cmdk-label">{o.kind === 'ask' ? L.ask(o.question) : o.command.label}</span>
                      {o.kind === 'command' && o.command.hint && <span className="cmdk-hint">{o.command.hint}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cmdk-empty" id={`${baseId}-list`}>{L.noResults}</p>
        ))}

        {asking && (
          <section className="cmdk-ans" aria-label={L.answer} aria-busy={busy}>
            <p className="cmdk-q">{ask.question}</p>
            {ask.status === 'loading' ? (
              <div className="cmdk-load">
                <span className="sr-only">{L.thinking}</span>
                <span className="skel" aria-hidden="true" /><span className="skel" aria-hidden="true" /><span className="skel" aria-hidden="true" />
              </div>
            ) : ask.status === 'error' ? (
              <div className="cmdk-err" role="alert">
                <p>{ALERT}{L.askFailed}</p>
                <button type="button" className="btn btn-secondary sm" onClick={() => { inputRef.current?.focus(); void startAsk(ask.question); }}>{L.retry}</button>
              </div>
            ) : (
              <p className="cmdk-a">{ask.text}<span className="cmdk-caret" aria-hidden="true" /></p>
            )}
            {ask.status === 'done' && ask.widget && <div className="cmdk-widget">{ask.widget}</div>}
            {ask.status === 'done' && (
              <div className="cmdk-acts">
                {onPin && ask.widget && (
                  <button
                    type="button"
                    className="btn btn-primary sm"
                    onClick={() => { const a = ask; close(); onPin({ question: a.question, text: a.text, widget: a.widget }); }}
                  >
                    {L.pin}
                  </button>
                )}
                <button type="button" className="btn btn-ghost sm" onClick={() => backToList('')}>{L.again}</button>
              </div>
            )}
          </section>
        )}

        <div className="cmdk-ft" aria-hidden="true">
          <span><kbd className="cmdk-kbd">↑</kbd><kbd className="cmdk-kbd">↓</kbd> {L.move}</span>
          <span><kbd className="cmdk-kbd">↵</kbd> {L.run}</span>
          {canAsk && <span><kbd className="cmdk-kbd">tab</kbd> {L.askKey}</span>}
          <span><kbd className="cmdk-kbd">esc</kbd> {L.close}</span>
        </div>
      </div>
    </div>
  );
}
