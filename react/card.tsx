import * as React from 'react';
import { cx } from './cx';

/** Product card at --r-md (law 7). Header divides; footer holds the actions, right-aligned. */
export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('card', className)} {...rest} />;
}

const isText = (n: React.ReactNode) => typeof n === 'string' || typeof n === 'number';

export function CardHeader({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  // Text-only titles (including interpolated ones like `Invoices {count}`) become the h4 heading.
  const text = Array.isArray(children) ? children.length > 0 && children.every(isText) : isText(children);
  return (
    <div className={cx('hd', className)} {...rest}>
      {text ? <h4>{children}</h4> : children}
    </div>
  );
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('bd', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ft', className)} {...rest} />;
}
