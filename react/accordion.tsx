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
        <details key={`${i}-${item.title}`} open={item.defaultOpen}>
          <summary>{item.title}</summary>
          <div className="accbody">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
