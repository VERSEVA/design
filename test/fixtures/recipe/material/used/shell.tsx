import { cx } from './cx';

export function Shell({ open }: { open: boolean }) {
  return <aside className={cx(open ? 'cside' : 'cside closed')}>Console side rail</aside>;
}
