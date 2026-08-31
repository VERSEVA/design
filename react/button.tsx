import * as React from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/** Law 8: equal-sized pairs; the fill says which leads. Press sits the control down 1px (contract). */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, type, ...rest }, ref) => (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cx('btn', `btn-${variant}`, size !== 'md' && size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
