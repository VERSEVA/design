import * as React from 'react';
import { cx } from './cx';

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  value: React.ReactNode;
  /** Rendered in the accent italic: a unit, never emphasis. */
  unit?: string;
  label: string;
}

/** Display-face numerals over a quiet label. Wrap a set in <div className="statrow">. */
export function Stat({ value, unit, label, className, children, ...rest }: StatProps) {
  return (
    <div className={cx('stat', className)} {...rest}>
      <div className="num">{value}{unit && <i>{unit}</i>}</div>
      <div className="lbl">{label}</div>
      {children && <div className="delta">{children}</div>}
    </div>
  );
}
