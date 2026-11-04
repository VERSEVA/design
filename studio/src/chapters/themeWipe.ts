// What site/theme.js exposed as window.versevaThemeWipe, for ported chapter
// scripts (motion's wipe demo): flip light and dark on the studio theme, with the
// studio's own circle wipe. The brand and the stored choice follow applyTheme.
import { applyTheme, getTheme, resolveMode, wipe } from '../theme';

export function chapterThemeWipe(e: { clientX?: number; clientY?: number } | null) {
  wipe(e, () => {
    const t = getTheme();
    applyTheme({ ...t, mode: resolveMode(t.mode) === 'light' ? 'dark' : 'light' });
  });
}
