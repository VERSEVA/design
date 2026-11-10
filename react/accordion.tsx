import * as React from 'react';
import { cx } from './cx';

export interface AccordionItem {
  title: string;
  content: React.ReactNode;
  defaultOpen?: boolean;
}

/** Content accordion on native details/summary: zero JS to work, full keyboard support for free. */
export function Accordion({ items, className }: { items: AccordionItem[]; className?: string }) {
  return (
    <div className={cx('acc', className)}>
      {items.map((item, i) => (
        <AccordionRow key={`${i}-${item.title}`} item={item} />
      ))}
    </div>
  );
}

/* details still toggles natively; onToggle only mirrors the state onto aria-expanded. */
function AccordionRow({ item }: { item: AccordionItem }) {
  const [open, setOpen] = React.useState(!!item.defaultOpen);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary aria-expanded={open}>{item.title}</summary>
      <div className="accbody">{item.content}</div>
    </details>
  );
}
