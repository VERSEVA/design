import * as React from 'react';
import { cx } from './cx';

export const BOUNDED_CAP = 5;
const MAX_CAP = 12;

/** The cap the CSS can hold: a whole number from 1 to 12. Anything else is the default, 5. */
export function boundedCap(cap: number = BOUNDED_CAP): number {
  return Number.isInteger(cap) && cap >= 1 && cap <= MAX_CAP ? cap : BOUNDED_CAP;
}

export interface BoundedSectionProps<T> extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** The section's name: its heading, and part of the Show all action's accessible name. */
  name: string;
  /** The rows the host has. Only the first `cap` are rendered. */
  items: readonly T[];
  /** Renders one row, e.g. a `.lrow`. */
  children: (item: T, index: number) => React.ReactNode;
  /** Rows on screen: 1 to 12, default 5. */
  cap?: number;
  /** How many rows exist, when `items` is only the first page. Default `items.length`. */
  total?: number;
  /** Where Show all goes. With `href` the action is a link, otherwise a button. */
  href?: string;
  onShowAll?: () => void;
  /** Shown in place of the rows when there are none, e.g. an `.empty` block. */
  empty?: React.ReactNode;
  /** Heading level of the name. Default 3. */
  level?: 2 | 3 | 4;
  /** Class of the rows element. Default `lrows`. */
  rowsClassName?: string;
  /** The action's label, for translation. Default "Show all". */
  showAllLabel?: string;
  /** The count row's text, for translation. Default "+N more". */
  moreLabel?: (more: number) => string;
}

/**
 * A section whose height never grows with its data: at most `cap` rows, a "+N more" count
 * above the cap, and a Show all action that opens the scoped view. For a table, put
 * `bounded` on the wrapper and `bounded-rows` on the tbody by hand.
 */
export function BoundedSection<T>({
  name, items, children, cap, total, href, onShowAll, empty, level = 3, rowsClassName = 'lrows',
  showAllLabel = 'Show all', moreLabel = (more) => `+${more} more`, className, ...rest
}: BoundedSectionProps<T>) {
  const id = React.useId();
  const n = boundedCap(cap);
  const more = Math.max(total ?? 0, items.length) - n;
  const Name = `h${level}` as 'h2' | 'h3' | 'h4';
  const action = { className: 'btn btn-secondary sm bounded-all', 'aria-label': `${showAllLabel} ${name}` };
  return (
    <section className={cx('bounded', className)} aria-labelledby={id} data-cap={n === BOUNDED_CAP ? undefined : n} {...rest}>
      <Name className="bounded-name" id={id}>{name}</Name>
      {items.length === 0 ? empty : (
        <>
          <div className={cx(rowsClassName, 'bounded-rows')}>
            {items.slice(0, n).map((item, i) => <React.Fragment key={i}>{children(item, i)}</React.Fragment>)}
          </div>
          <div className="bounded-foot">
            {more > 0 && <p className="bounded-more" role="status">{moreLabel(more)}</p>}
            {href
              ? <a {...action} href={href} onClick={onShowAll}>{showAllLabel}</a>
              : <button {...action} type="button" onClick={onShowAll}>{showAllLabel}</button>}
          </div>
        </>
      )}
    </section>
  );
}
