// Shell icons: one stroke family (24 grid, 1.8 stroke, round caps), currentColor only.
import type { ReactNode } from 'react';

const I = ({ children, className }: { children: ReactNode; className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export const SunIcon = ({ className }: { className?: string }) => <I className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></I>;
export const MoonIcon = ({ className }: { className?: string }) => <I className={className}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></I>;
export const MonitorIcon = ({ className }: { className?: string }) => <I className={className}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></I>;
export const SearchIcon = () => <I><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></I>;
export const HomeIcon = () => <I><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z" /></I>;
export const SwatchIcon = () => <I><circle cx="8" cy="8" r="4" /><circle cx="16" cy="8" r="4" /><circle cx="12" cy="15.5" r="4" /></I>;
export const CubeIcon = () => <I><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></I>;
export const GridIcon = () => <I><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></I>;
export const BookIcon = () => <I><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5ZM13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13Z" /></I>;
export const FramesIcon = () => <I><rect x="3" y="6" width="14" height="12" rx="2" /><path d="M7 3h12a2 2 0 0 1 2 2v10M3 15l4-4 4 4 2-2 4 4" /></I>;
export const SidebarIcon = () => <I><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 10l-2 2 2 2" /></I>;
export const ChevronIcon = () => <svg className="sgroup-chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;

export const PAGE_ICONS: Readonly<Record<string, () => ReactNode>> = {
  '/': HomeIcon,
  '/foundations': SwatchIcon,
  '/assets': CubeIcon,
  '/widgets': GridIcon,
};
export const GROUP_ICONS: Readonly<Record<string, () => ReactNode>> = { chapters: BookIcon, gallery: FramesIcon };
