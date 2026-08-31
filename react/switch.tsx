import * as React from 'react';
import { cx } from './cx';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** The word carries the state; the color only agrees with it (law 10). */
  label: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, className, ...rest }, ref) => (
    <label className={cx('sel', 'switch-wrap', className)}>
      <input ref={ref} className="sw" type="checkbox" {...rest} />
      <span className="switch" aria-hidden="true" />
      {label}
    </label>
  )
);
Switch.displayName = 'Switch';

export const Checkbox = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, className, ...rest }, ref) => (
    <label className={cx('sel', className)}>
      <input ref={ref} type="checkbox" {...rest} />
      {label}
    </label>
  )
);
Checkbox.displayName = 'Checkbox';
