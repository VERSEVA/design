'use client';
import * as React from 'react';
import { cx } from './cx';
import {
  CUSTOM_RANGE, DATE_RANGE_LABELS, checkRange, chosenPreset, isDate, limit, moveIndex, rangeText, snapRange,
  type DateRangeEdge, type DateRangeErrors, type DateRangeLabels, type DateRangePreset, type DateRangeSnap, type DateRangeValue,
} from './date-range-state';

export type { DateRangeEdge, DateRangeErrors, DateRangeLabels, DateRangePreset, DateRangeSnap, DateRangeValue } from './date-range-state';

/* Bundlers replace process.env.NODE_ENV; without one there is no process and no warning. */
declare const process: { env: { NODE_ENV?: string } } | undefined;

export interface DateRangeProps {
  /** 'segmented' (default): presets in a row with inline custom dates. 'menu': one trigger, for a page header. */
  variant?: 'segmented' | 'menu';
  /** The host's presets, each with the dates it stands for. The part ships none. A preset reads as
      chosen only when the value has its name and both its dates; any other dates read as Custom. */
  presets: DateRangePreset[];
  /** Controlled. The part keeps no value of its own and never reads or writes the URL. */
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Adds Custom: two date fields, inline on a desktop, in a sheet under 560px. */
  custom?: boolean;
  /** Adds the Compare toggle. */
  compare?: boolean;
  /** Snaps a custom date when its field loses focus (to whole weeks, say). Never while typing. */
  snap?: DateRangeSnap;
  /** Earliest start and latest end a custom range may have, 'YYYY-MM-DD'. A malformed one is ignored. */
  min?: string;
  max?: string;
  /** Joined to the range line, e.g. 'UTC'. The part does no time zone math. */
  zone?: string;
  /** The range line's text. Default '23 Nov to 29 Nov 2026'. */
  formatRange?: (from: string, to: string) => string;
  /** What the menu trigger calls a custom range, e.g. '6 weeks'. Default labels.custom. */
  formatCustom?: (from: string, to: string) => string;
  labels?: Partial<DateRangeLabels>;
  disabled?: boolean;
  /** Prefix for the ids of the fields, the trigger and the list. Default React.useId(). */
  id?: string;
  className?: string;
}

interface Draft { from: string; to: string }

const PHONE = '(max-width: 559.98px)';
const isPhone = () => typeof matchMedia === 'function' && matchMedia(PHONE).matches;

const icon = (d: React.ReactNode, size = 16, className?: string) => (
  <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{d}</svg>
);
const CAL = icon(<><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 7h11M5.5 2v3M10.5 2v3" /></>);
const CHEV = icon(<path d="M4.5 6.5L8 10l3.5-3.5" />);
const CLOSE = icon(<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />);
const TICK = icon(<path d="M3.5 8.5l3 3 6-7" />, 14, 'tick');

interface FieldsProps {
  id: string;
  draft: Draft;
  errors: DateRangeErrors;
  labels: DateRangeLabels;
  min?: string;
  max?: string;
  disabled?: boolean;
  onDraft: (edge: DateRangeEdge, date: string) => void;
  onLeave: (edge: DateRangeEdge) => void;
  onEnter: () => void;
}

/** The two custom date fields: the existing .field, with its fix-it error. */
function Fields({ id, draft, errors, labels, min, max, disabled, onDraft, onLeave, onEnter }: FieldsProps) {
  const field = (k: DateRangeEdge, label: string) => {
    const msg = errors[k];
    return (
      <div className={cx('field', msg && 'error')}>
        <label htmlFor={`${id}-${k}`}>{label}</label>
        <input
          type="date"
          id={`${id}-${k}`}
          data-k={k}
          value={draft[k]}
          min={min}
          max={max}
          disabled={disabled}
          aria-invalid={msg ? true : undefined}
          aria-describedby={msg ? `${id}-${k}-e` : undefined}
          onChange={(e) => onDraft(k, e.target.value)}
          onBlur={() => onLeave(k)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
        />
        <p className="help" id={`${id}-${k}-e`} hidden={!msg}>{msg}</p>
      </div>
    );
  };
  return <>{field('from', labels.from)}{field('to', labels.to)}</>;
}

interface CustomDialogProps {
  kind: 'sheet' | 'modal';
  id: string;
  initial: Draft;
  labels: DateRangeLabels;
  min?: string;
  max?: string;
  snap?: DateRangeSnap;
  onApply: (draft: Draft) => void;
  onDone: () => void;
}

/** Custom dates in the existing .sheet (phone) or .modal, on a native dialog: focus trap, Escape, inert page. */
function CustomDialog({ kind, id, initial, labels, min, max, snap, onApply, onDone }: CustomDialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = React.useState(initial);
  const [errors, setErrors] = React.useState<DateRangeErrors>({});

  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
    d.querySelector('input')?.focus();
  }, []);

  const shut = () => {
    const d = ref.current;
    if (d?.open && typeof d.close === 'function') d.close();
  };
  const done = () => { shut(); onDone(); };
  const apply = () => {
    const next = snapRange(draft.from, draft.to, snap);
    const r = checkRange(next.from, next.to, { min, max, labels });
    setDraft(next);
    setErrors(r.errors);
    if (r.ok) { shut(); onApply(next); }
    else ref.current?.querySelector<HTMLInputElement>(`input[data-k="${r.errors.from ? 'from' : 'to'}"]`)?.focus();
  };
  const fields = (
    <div className="range-fields mt-4">
      <Fields
        id={id}
        draft={draft}
        errors={errors}
        labels={labels}
        min={min}
        max={max}
        onDraft={(k, date) => setDraft((d) => ({ ...d, [k]: date }))}
        onLeave={() => setDraft((d) => snapRange(d.from, d.to, snap))}
        onEnter={apply}
      />
    </div>
  );
  const foot = (
    <div className="ft">
      <button type="button" className="btn btn-secondary" onClick={done}>{labels.cancel}</button>
      <button type="button" className="btn btn-primary" onClick={apply}>{labels.apply}</button>
    </div>
  );

  return (
    <dialog
      ref={ref}
      className={kind}
      aria-labelledby={`${id}-t`}
      onCancel={(e) => { e.preventDefault(); done(); }}
      onClick={(e) => {
        /* a press on the backdrop lands on the dialog itself, outside its box */
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) done();
      }}
    >
      {kind === 'sheet' ? (
        <>
          <div className="grab" aria-hidden="true" />
          <div className="bd">
            <h4 id={`${id}-t`}>{labels.customTitle}</h4>
            {fields}
          </div>
        </>
      ) : (
        <div className="bd">
          <h4 id={`${id}-t`}>{labels.customTitle}</h4>
          <button type="button" className="btn btn-ghost icon" aria-label={labels.close} onClick={done}>{CLOSE}</button>
          {fields}
        </div>
      )}
      {foot}
    </dialog>
  );
}

/**
 * Sets the period a page of charts covers. Segmented presets by default (a radiogroup on the
 * existing .seg: arrows, Home and End move and choose), with an optional Compare chip, a quiet
 * range line and two date fields for Custom. variant="menu" puts the presets behind one trigger
 * (the existing .menu: arrows, Home, End; Escape closes and returns focus to the trigger).
 * Under 560px the custom dates open in the existing .sheet. Controlled: every change is one
 * onChange with the whole value, and an invalid custom range emits nothing. A preset reads as
 * chosen only when the value has its name and both its dates; other dates read as Custom, or as
 * nothing chosen when the host passes no Custom.
 */
export function DateRange({
  variant = 'segmented', presets, value, onChange, custom = false, compare = false, snap, min, max, zone,
  formatRange = rangeText, formatCustom, labels, disabled = false, id, className,
}: DateRangeProps) {
  const L: DateRangeLabels = { ...DATE_RANGE_LABELS, ...labels };
  const autoId = React.useId();
  const uid = id ?? autoId;
  /* A preset is chosen when the value has its name and both its dates. Any other dates are a
     custom range, whatever name they came under (a link from last week still says "7"). */
  const chosen = chosenPreset(presets, value);
  const isCustom = custom && chosen < 0;
  const lo = limit(min), hi = limit(max);
  const check = (d: Draft) => checkRange(d.from, d.to, { min: lo, max: hi, labels: L });

  /* A field shows the host's value, except while the user is mid-edit in it: `edit` holds only
     what was typed and not yet committed. A valid commit clears it, so a change the host
     refuses falls back to the value. A change of the host's range or dates, or the fields
     closing, drops the typed text and its error, so an abandoned edit never comes back. */
  const NO_EDIT = { from: null, to: null };
  const [edit, setEdit] = React.useState<{ from: string | null; to: string | null }>(NO_EDIT);
  const draft: Draft = { from: edit.from ?? value.from, to: edit.to ?? value.to };
  const [errors, setErrors] = React.useState<DateRangeErrors>(() => (isCustom ? check(draft).errors : {}));
  const [seen, setSeen] = React.useState({ range: value.range, from: value.from, to: value.to, isCustom });
  if (seen.range !== value.range || seen.from !== value.from || seen.to !== value.to || seen.isCustom !== isCustom) {
    setSeen({ range: value.range, from: value.from, to: value.to, isCustom });
    setEdit(NO_EDIT);
    setErrors(isCustom ? check({ from: value.from, to: value.to }).errors : {});
  }

  const [dialog, setDialog] = React.useState<'sheet' | 'modal' | null>(null);
  const [phone, setPhone] = React.useState(false);
  const [roving, setRoving] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);
  const openAt = React.useRef<'checked' | 'last'>('checked');
  const back = React.useRef<HTMLElement | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const trigRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(PHONE);
    const sync = () => setPhone(m.matches);
    sync();
    m.addEventListener?.('change', sync);
    return () => m.removeEventListener?.('change', sync);
  }, []);

  const values = presets.map((p) => p.value).join('\n');
  React.useEffect(() => {
    if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') return;
    const list = values ? values.split('\n') : [];
    const twice = list.find((v, i) => list.indexOf(v) !== i);
    if (twice !== undefined) console.warn(`DateRange: two presets share the value "${twice}"; the first one is the one chosen.`);
    if (min !== undefined && !isDate(min)) console.warn(`DateRange: min="${min}" is not a YYYY-MM-DD date and is ignored.`);
    if (max !== undefined && !isDate(max)) console.warn(`DateRange: max="${max}" is not a YYYY-MM-DD date and is ignored.`);
  }, [values, min, max]);

  React.useEffect(() => {
    if (!open) return;
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [])];
    const at = openAt.current === 'last' ? items[items.length - 1] : items.find((b) => b.getAttribute('role') === 'menuitemradio' && b.getAttribute('aria-checked') === 'true') ?? items[0];
    at?.focus();
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const pickPreset = (p: DateRangePreset) => {
    if (value.range === p.value && value.from === p.from && value.to === p.to) return;
    onChange({ ...value, range: p.value, from: p.from, to: p.to });
  };
  const toggleCompare = () => onChange({ ...value, compare: !value.compare });
  const openDialog = (kind: 'sheet' | 'modal', from: HTMLElement | null) => { back.current = from; setDialog(kind); };
  const closeDialog = () => {
    setDialog(null);
    const el = back.current;
    if (el?.isConnected) el.focus();
  };
  const applyDialog = (d: Draft) => {
    if (value.range !== CUSTOM_RANGE || d.from !== value.from || d.to !== value.to) onChange({ ...value, range: CUSTOM_RANGE, from: d.from, to: d.to });
    closeDialog();
  };
  /* Inline fields: snap, check, and emit only a valid range that differs from the value. */
  const commitInline = () => {
    const next = snapRange(draft.from, draft.to, snap);
    const r = check(next);
    setErrors(r.errors);
    if (!r.ok) {
      setEdit({ from: next.from === value.from ? null : next.from, to: next.to === value.to ? null : next.to });
      return;
    }
    setEdit({ from: null, to: null });
    if (next.from !== value.from || next.to !== value.to) onChange({ ...value, range: CUSTOM_RANGE, from: next.from, to: next.to });
  };

  const line = formatRange(value.from, value.to);
  const versus = compare && value.compare ? ` · ${L.vsPrevious}` : '';
  const sheet = dialog && (
    <CustomDialog kind={dialog} id={`${uid}-d`} initial={{ from: value.from, to: value.to }} labels={L} min={lo} max={hi} snap={snap} onApply={applyDialog} onDone={closeDialog} />
  );

  if (variant === 'menu') {
    /* the preset's name, the custom label, or (a value that is neither) the range itself */
    const chosenPreset = presets[chosen];
    const current = chosenPreset ? chosenPreset.label : isCustom ? formatCustom?.(value.from, value.to) ?? L.custom : null;
    const close = (refocus: boolean) => { setOpen(false); if (refocus) trigRef.current?.focus(); };
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!open) {
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target === trigRef.current) {
          e.preventDefault();
          openAt.current = e.key === 'ArrowUp' ? 'last' : 'checked';
          setOpen(true);
        }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key === 'Tab') { setOpen(false); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
      const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [])];
      const to = moveIndex(e.key, items.indexOf(document.activeElement as HTMLButtonElement), items.length);
      if (to === null) return;
      e.preventDefault();
      items[to]?.focus();
    };
    return (
      <div className={cx('menu', className)} data-range="menu" ref={rootRef} onKeyDown={onKeyDown}>
        <button
          ref={trigRef}
          type="button"
          className="btn btn-secondary"
          id={`${uid}-t`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={`${uid}-m`}
          disabled={disabled}
          onClick={() => { openAt.current = 'checked'; setOpen(!open); }}
        >
          {CAL}
          <span className="sr-only">{`${L.range}: `}</span>
          <span data-lbl="">{current ?? `${line}${versus}`}</span>
          {current !== null && <span className="metaline" data-dates="">{`${line}${versus}`}</span>}
          {CHEV}
        </button>
        <div className="menu-list" role="menu" id={`${uid}-m`} aria-labelledby={`${uid}-t`} hidden={!open} ref={listRef}>
          {/* the one-of-a-set presets are a group, apart from the Compare on/off item */}
          <div role="group" aria-label={L.range}>
            {presets.map((p, i) => (
              <button key={`${i}-${p.value}`} type="button" className="menu-item" role="menuitemradio" aria-checked={i === chosen} tabIndex={-1} data-v={p.value} onClick={() => { close(true); pickPreset(p); }}>
                <span>{p.label}</span>
                <span className="metaline">{formatRange(p.from, p.to)}</span>
                {TICK}
              </button>
            ))}
            {custom && (
              <button type="button" className="menu-item" role="menuitemradio" aria-checked={isCustom} aria-haspopup="dialog" tabIndex={-1} data-v={CUSTOM_RANGE} onClick={() => { close(false); openDialog(isPhone() ? 'sheet' : 'modal', trigRef.current); }}>
                <span>{L.custom}</span>
                {TICK}
              </button>
            )}
          </div>
          {compare && (
            <>
              <div className="menu-sep" role="separator" />
              <button type="button" className="menu-item" role="menuitemcheckbox" aria-checked={value.compare} tabIndex={-1} data-v="cmp" onClick={() => { close(true); toggleCompare(); }}>
                <span>{L.compareLong}</span>
                {TICK}
              </button>
            </>
          )}
        </div>
        {sheet}
      </div>
    );
  }

  const options = [...presets.map((p) => ({ v: p.value, label: p.label, preset: p as DateRangePreset | null })), ...(custom ? [{ v: CUSTOM_RANGE, label: L.custom, preset: null }] : [])];
  /* the checked option by position: a preset by its index, Custom last, none when nothing matches */
  const on = chosen >= 0 ? chosen : isCustom ? options.length - 1 : -1;
  const stop = roving ?? (on >= 0 ? on : 0);
  const pick = (at: number, el: HTMLElement, how: 'click' | 'key') => {
    const o = options[at];
    if (!o) return;
    if (o.preset) { pickPreset(o.preset); return; }
    if (isPhone()) {
      /* an arrow onto Custom only moves focus; the sheet opens on a tap, Enter or Space */
      if (how === 'click') openDialog('sheet', el);
      else setRoving(at);
      return;
    }
    if (value.range !== CUSTOM_RANGE) onChange({ ...value, range: CUSTOM_RANGE });
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const list = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const to = moveIndex(e.key, at, list.length);
    const el = to === null ? undefined : list[to];
    if (to === null || !el) return;
    e.preventDefault();
    el.focus();
    setRoving(null);
    pick(to, el, 'key');
  };

  return (
    <div className={cx('range-ctl', className)}>
      <div
        className="seg"
        role="radiogroup"
        aria-label={L.range}
        onKeyDown={onKeyDown}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRoving(null); }}
      >
        {options.map((o, i) => (
          <button
            key={`${i}-${o.v}`}
            type="button"
            role="radio"
            aria-checked={i === on}
            aria-haspopup={!o.preset && phone ? 'dialog' : undefined}
            tabIndex={i === stop ? 0 : -1}
            data-v={o.v}
            disabled={disabled}
            onClick={(e) => pick(i, e.currentTarget, 'click')}
          >
            {o.label}
          </button>
        ))}
      </div>
      {custom && (
        <div className="range-fields" hidden={!isCustom}>
          <Fields id={uid} draft={draft} errors={errors} labels={L} min={lo} max={hi} disabled={disabled} onDraft={(k, date) => setEdit((e) => ({ ...e, [k]: date }))} onLeave={commitInline} onEnter={commitInline} />
        </div>
      )}
      {compare && (
        <button type="button" className="fchip" aria-pressed={value.compare} aria-label={L.compareLong} disabled={disabled} onClick={toggleCompare}>{L.compare}</button>
      )}
      <p className="metaline" aria-live="polite">{`${line}${zone ? ` · ${zone}` : ''}${versus}`}</p>
      {sheet}
    </div>
  );
}
