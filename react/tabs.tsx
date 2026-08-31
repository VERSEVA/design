import * as React from 'react';
import { cx } from './cx';

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  /** id of the panel each tab controls, as `${panelId}-${value}`; wire your panels with role="tabpanel". */
  panelId?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * In-page section tabs. The active underline is the accent, never a hairline
 * (law 11). Keyboard per the APG tabs pattern: roving tabindex, arrows move
 * and select, Home/End jump.
 */
export function Tabs({ items, value, onChange, panelId, className, ...rest }: TabsProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const current = items.findIndex((i) => i.value === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (current + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next === -1) return;
    e.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={cx('tabbar', className)} role="tablist" onKeyDown={onKeyDown} {...rest}>
      {items.map((item, i) => (
        <button
          key={item.value}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          aria-controls={panelId ? `${panelId}-${item.value}` : undefined}
          tabIndex={item.value === value ? 0 : -1}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
