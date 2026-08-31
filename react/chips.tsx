import * as React from 'react';
import { cx } from './cx';

export interface ChipOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterChipsProps {
  options: ChipOption[];
  /** Selected values. Single-select: pass at most one and handle replacement in onChange. */
  selected: string[];
  onChange: (selected: string[]) => void;
  multi?: boolean;
  className?: string;
}

/** Filter chips; aria-pressed carries the state, counts are mono machine artifacts. */
export function FilterChips({ options, selected, onChange, multi = false, className }: FilterChipsProps) {
  const toggle = (value: string) => {
    if (!multi) return onChange([value]);
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <div className={cx('chiprow', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="fchip"
          aria-pressed={selected.includes(opt.value)}
          onClick={() => toggle(opt.value)}
        >
          {opt.label}
          {opt.count !== undefined && <span className="cnt">{opt.count}</span>}
        </button>
      ))}
    </div>
  );
}
