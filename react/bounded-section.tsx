'use client';
import * as React from 'react';
import { cx } from './cx';

/* Bundlers replace process.env.NODE_ENV; without one there is no process and no warning. */
declare const process: { env: { NODE_ENV?: string } } | undefined;

export const BOUNDED_CAP = 5;
const MAX_CAP = 12;

/** The cap the CSS can hold: a whole number from 1 to 12. Anything else is the default, 5. */
export function boundedCap(cap: number = BOUNDED_CAP): number {
  return Number.isInteger(cap) && cap >= 1 && cap <= MAX_CAP ? cap : BOUNDED_CAP;
}

/** Show all needs somewhere to go: a link, a handler, or both. */
type ShowAll = { href: string; onShowAll?: () => void } | { href?: undefined; onShowAll: () => void };

interface BoundedSectionBase<T> extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** The section's name: its heading, and part of the Show all action's accessible name. */
  name: string;
  /** The rows the host has. Only the first `cap` are rendered. */
  items: readonly T[];
  /** Renders one row, e.g. a `.lrow`. */
  children: (item: T, index: number) => React.ReactNode;
  /** A stable key per row, so row state follows its item on reorder. Default: the index. */
  getKey?: (item: T, index: number) => React.Key;
  /** Rows on screen: 1 to 12, default 5. Any other value falls back to 5, with a warning in development. */
  cap?: number;
  /** How many rows exist, when `items` is only the first page. Default `items.length`. */
  total?: number;
  /** Keep Show all below the cap too, for a scoped view that adds filters or sorting. Default false. */
  showAllBelowCap?: boolean;
  /** Shown in place of the rows when there are none, e.g. an `.empty` block. */
  empty?: React.ReactNode;
  /** Heading level of the name. Default 3. */
  level?: 2 | 3 | 4;
  /** Class of the rows element. Default `lrows`. */
  rowsClassName?: string;
  /** The action's label, for translation. Default "Show all". */
  showAllLabel?: string;
  /** The count's text, for translation. Default "+N more". */
  moreLabel?: (more: number) => string;
}

export type BoundedSectionProps<T> = BoundedSectionBase<T> & ShowAll;

/**
 * A section whose height never grows with its data: at most `cap` rows, a "+N more" count
 * above the cap, and a Show all action (at the cap and above) that opens the scoped view:
 * a link with `href`, a button with `onShowAll`. For a table, put `bounded` on the wrapper
 * and `bounded-rows` on the tbody by hand.
 */
export function BoundedSection<T>({
  name, items, children, getKey, cap, total, href, onShowAll, showAllBelowCap = false, empty, level = 3,
  rowsClassName = 'lrows', showAllLabel = 'Show all', moreLabel = (more) => `+${more} more`, className, ...rest
}: BoundedSectionProps<T>) {
  const id = React.useId();
  const n = boundedCap(cap);
  const count = Math.max(total ?? 0, items.length);
  const more = count - n;
  const wired = href !== undefined || onShowAll !== undefined;
  const showAll = wired && (count >= n || showAllBelowCap);
  const Name = `h${level}` as 'h2' | 'h3' | 'h4';
  const action = { className: 'btn btn-secondary sm bounded-all', 'aria-label': `${showAllLabel} ${name}` };

  React.useEffect(() => {
    if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') return;
    if (cap !== undefined && n !== cap) console.warn(`BoundedSection: cap ${cap} is not a whole number from 1 to ${MAX_CAP}; using ${BOUNDED_CAP}.`);
    if (!wired) console.warn('BoundedSection: pass href or onShowAll; without one there is no Show all action.');
  }, [cap, n, wired]);

  return (
    <section
      className={cx('bounded', className)}
      {...rest}
      aria-labelledby={id}
      data-cap={n === BOUNDED_CAP ? undefined : n}
      data-all={showAllBelowCap ? 'always' : undefined}
    >
      <Name className="bounded-name" id={id}>{name}</Name>
      {items.length === 0 ? empty : (
        <>
          <div className={cx(rowsClassName, 'bounded-rows')}>
            {items.slice(0, n).map((item, i) => <React.Fragment key={getKey ? getKey(item, i) : i}>{children(item, i)}</React.Fragment>)}
          </div>
          <div className="bounded-foot">
            <p className="bounded-more" role="status">{more > 0 ? moreLabel(more) : null}</p>
            {showAll && (href !== undefined
              ? <a {...action} href={href} onClick={onShowAll}>{showAllLabel}</a>
              : <button {...action} type="button" onClick={onShowAll}>{showAllLabel}</button>)}
          </div>
        </>
      )}
    </section>
  );
}
