// Chapters whose presentation was redesigned on purpose, so the element-for-element
// parity with their frozen site/*.html is retired for them (markup, <style> and the
// FROZEN pin). What stays: the anchors, cold deep links, the specimen markup against its
// generated code samples, and the chapter script's behaviour. Each entry says why and where.
export const REDESIGNED: Readonly<Record<string, string>> = {
  components: 'studio specimen tiles in the /widgets language (1.7.0, feat/studio-tiles); tested by specimen-tile.test.tsx',
};
