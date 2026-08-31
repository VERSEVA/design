import * as React from 'react';
import { cx } from './cx';

export interface TooltipProps {
  /** Keep it short; a tooltip is a label, not a doc. */
  text: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Hover/focus tooltip on the inverse ground. Never put load-bearing content
 * here. The description lands on the interactive child (aria-describedby),
 * Escape dismisses while shown (WCAG 1.4.13), and the box stays hoverable.
 */
export function Tooltip({ text, children, className }: TooltipProps) {
  const id = React.useId();
  const [dismissed, setDismissed] = React.useState(false);

  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': id })
    : children;

  return (
    <span
      className={cx('tip', className)}
      onKeyDown={(e) => { if (e.key === 'Escape') setDismissed(true); }}
      onMouseLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      {child}
      <span className={cx('tipbox', dismissed && 'tiphide')} role="tooltip" id={id}>{text}</span>
    </span>
  );
}
