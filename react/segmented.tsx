import * as React from 'react';
import { cx } from './cx';

export interface SegmentedProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}

/** One selected at all times; aria-selected carries it. */
export function Segmented({ options, value, onChange, className, ...rest }: SegmentedProps) {
  return (
    <div className={cx('seg', className)} role="tablist" {...rest}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="tab"
          aria-selected={opt === value}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
