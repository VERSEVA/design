import * as React from 'react';
import { cx } from './cx';

export interface MenuItemDef {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
}

export interface MenuProps {
  /** The trigger content; rendered inside a secondary button. */
  trigger: React.ReactNode;
  items: (MenuItemDef | 'separator')[];
  className?: string;
}

/**
 * Dropdown menu per the APG pattern: focus moves to the first item on open,
 * arrows cycle, Escape closes and returns focus to the trigger, outside click
 * closes. Danger items carry the word AND the color.
 */
export function Menu({ trigger, items, className }: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const focusItem = (dir: 1 | -1 | 0) => {
    const nodes = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [])];
    if (!nodes.length) return;
    const at = nodes.indexOf(document.activeElement as HTMLButtonElement);
    const next = dir === 0 || at === -1 ? (dir === -1 ? nodes.length - 1 : 0) : (at + dir + nodes.length) % nodes.length;
    nodes[next].focus();
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  React.useEffect(() => {
    if (!open) return;
    focusItem(0);
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); open ? focusItem(1) : setOpen(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); open ? focusItem(-1) : setOpen(true); }
  };

  return (
    <div className={cx('menu', className)} ref={rootRef} onKeyDown={onKeyDown}>
      <button ref={triggerRef} type="button" className="btn btn-secondary sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {trigger}
      </button>
      <div className="menu-list" role="menu" hidden={!open} ref={listRef}>
        {items.map((item, i) =>
          item === 'separator' ? (
            <div className="menu-sep" key={`sep-${i}`} role="separator" />
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={cx('menu-item', item.danger && 'danger')}
              onClick={() => { close(true); item.onSelect(); }}
            >
              {item.icon}
              {item.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
