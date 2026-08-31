import * as React from 'react';
import { cx } from './cx';

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Quiet guidance under the input. Replaced by `error` when present. */
  help?: string;
  /** The error state says what went wrong and how to fix it; no apologies, no vagueness. */
  error?: string;
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, help, error, id, className, ...rest }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const helpId = `${inputId}-help`;
    const text = error ?? help;
    return (
      <div className={cx('field', error && 'error', className)}>
        <label htmlFor={inputId}>{label}</label>
        <input ref={ref} id={inputId} aria-invalid={!!error || undefined} aria-describedby={text ? helpId : undefined} {...rest} />
        {text && <div className="help" id={helpId}>{text}</div>}
      </div>
    );
  }
);
Field.displayName = 'Field';
