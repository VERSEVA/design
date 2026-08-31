import * as React from 'react';
import { cx } from './cx';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'ok' | 'warn' | 'err' | 'neutral';
}

/** Law 10: status is a word on a tint, never a dot alone. Give it real words and counts. */
export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return <span className={cx('badge', tone, className)} {...rest} />;
}
