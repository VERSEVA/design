// Chapters whose presentation was redesigned on purpose, so the element-for-element
// parity with their frozen site/*.html is retired for them (markup, <style> and the
// FROZEN pin). What stays: the anchors, cold deep links, the specimen markup against its
// generated code samples, and the chapter script's behaviour. Each entry says why and where.
export const REDESIGNED: Readonly<Record<string, string>> = {
  components: 'studio specimen tiles in the /widgets language (1.7.0, feat/studio-tiles); tested by specimen-tile.test.tsx',
  'web-ui': 'studio specimen tiles: ladders, type and radius tables plus four contract specimens (1.7.0, feat/tiles-chapters-a); tested by chapter-tiles.test.tsx',
  distribute: 'studio specimen tiles: commands, agent tools and theme presets as tiles (1.7.0, feat/tiles-chapters-a); tested by chapter-tiles.test.tsx',
  'docs-pdf': 'studio specimen tiles: the memo anatomy as one XL tile (1.7.0, feat/tiles-chapters-a); tested by chapter-tiles.test.tsx',
};
