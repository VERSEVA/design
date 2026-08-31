import * as React from 'react';
import { cx } from './cx';

/** Loading is a state of the real layout (states floor): skeleton bars mirror what will load. */
export function Skeleton({ width, className, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { width?: string }) {
  return <span className={cx('skel', className)} style={width ? { width } : undefined} {...rest} aria-hidden="true" />;
}

/** A ready-made identity-row skeleton matching the lrow pattern. */
export function SkeletonRow() {
  return (
    <div className="lrow" aria-hidden="true">
      <span className="avc" />
      <span className="tx skelstack">
        <Skeleton width="62%" />
        <Skeleton width="38%" />
      </span>
    </div>
  );
}

/* .skelstack { display: grid; gap: var(--s-2); } ships in the site css; add it at class level. */
