import * as React from 'react';
import { cx } from './cx';

export interface MenuItemDef {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
  /** Present (true or false) renders role="menuitemradio" + aria-checked + a trailing tick. */
  checked?: boolean;
  /** Trailing slot rendered in <span className="mhint"> (role, kbd, version). */
  hint?: React.ReactNode;
  /** Renders disabled; arrows skip it. */
  disabled?: boolean;
  /** React key when two labels repeat; defaults to label. */
  id?: string;
}

export interface MenuTriggerProps {
  ref: React.Ref<HTMLButtonElement>;
  type: 'button';
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string;
  onClick: () => void;
}

export interface MenuProps {
  /** The trigger content; rendered inside a secondary button when renderTrigger is absent. */
  trigger?: React.ReactNode;
  /** Render your own trigger (switcher, capsule, icon button); spread props onto the button. */
  renderTrigger?: (props: MenuTriggerProps, open: boolean) => React.ReactNode;
  items: (MenuItemDef | 'separator')[];
  className?: string;
  /** aria-label on the role="menu" list. */
  label?: string;
  /** Extra classes on .menu-list (e.g. 'full', 'up'). */
  listClassName?: string;
  /** 'end' right-aligns the list. Default 'start'. */
  align?: 'start' | 'end';
  /** Called whenever the open state changes. */
  onOpenChange?: (open: boolean) => void;
}

const TICK = (
  <svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

/**
 * Dropdown menu per the APG pattern: focus moves to the checked item (else the
 * first enabled one) on open, arrows cycle and skip disabled items, Home/End
 * jump, Escape closes and returns focus to the trigger, Tab and outside click
 * close. Selecting closes and refocuses the trigger before onSelect runs.
 * Danger items carry the word AND the color.
 */
export function Menu({ trigger, renderTrigger, items, className, label, listClassName, align = 'start', onOpenChange }: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const notified = React.useRef(open);

  const enabled = () => [...(listRef.current?.querySelectorAll<HTMLButtonElement>('.menu-item:not(:disabled)') ?? [])];

  const focusItem = (dir: 1 | -1) => {
    const nodes = enabled();
    if (!nodes.length) return;
    const at = nodes.indexOf(document.activeElement as HTMLButtonElement);
    const next = at === -1 ? (dir === -1 ? nodes.length - 1 : 0) : (at + dir + nodes.length) % nodes.length;
    nodes[next].focus();
  };

  const focusEdge = (last: boolean) => {
    const nodes = enabled();
    nodes[last ? nodes.length - 1 : 0]?.focus();
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  React.useEffect(() => {
    if (notified.current === open) return;
    notified.current = open;
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (!open) return;
    const checked = listRef.current?.querySelector<HTMLButtonElement>('.menu-item[aria-checked="true"]:not(:disabled)');
    if (checked) checked.focus();
    else focusEdge(false);
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target === triggerRef.current) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(-1); }
    else if (e.key === 'Home') { e.preventDefault(); focusEdge(false); }
    else if (e.key === 'End') { e.preventDefault(); focusEdge(true); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const triggerProps: MenuTriggerProps = {
    ref: triggerRef,
    type: 'button',
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': listId,
    onClick: () => setOpen(!open),
  };

  return (
    <div className={cx('menu', align === 'end' && 'end', className)} ref={rootRef} onKeyDown={onKeyDown}>
      {renderTrigger ? renderTrigger(triggerProps, open) : (
        <button {...triggerProps} className="btn btn-secondary sm">
          {trigger}
        </button>
      )}
      <div className={cx('menu-list', listClassName)} id={listId} role="menu" aria-label={label} hidden={!open} ref={listRef}>
        {items.map((item, i) =>
          item === 'separator' ? (
            <div className="menu-sep" key={`sep-${i}`} role="separator" />
          ) : (
            <button
              key={item.id ?? item.label}
              type="button"
              role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={item.checked}
              tabIndex={-1}
              disabled={item.disabled}
              className={cx('menu-item', item.danger && 'danger')}
              onClick={() => { close(true); item.onSelect(); }}
            >
              {item.icon}
              {item.label}
              {item.hint ? <>{' '}<span className="mhint">{item.hint}</span></> : null}
              {item.checked !== undefined && TICK}
            </button>
          )
        )}
      </div>
    </div>
  );
}
