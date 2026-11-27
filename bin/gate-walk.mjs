/**
 * The file walk shared by the scanning gates (hex, spacing, type, recipe).
 *
 * walk(root, { exts, exclude, sort }) yields the files to read under one scan root:
 * - A root that is a file is yielded as given, whatever its extension.
 * - Under a directory root, files whose extension is in exts are yielded as
 *   path.join(dir, name). SKIP_DIRS and every --exclude name are skipped at every depth.
 * - A symlinked entry (file or directory) is never followed. An explicitly passed root
 *   is still followed, as the caller named it.
 * - A file whose real path falls outside the root's real path is not yielded.
 * - sort orders each directory's entries by name; otherwise readdir order is kept.
 */
import fs from 'node:fs';
import path from 'node:path';

export const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo', '.vercel']);

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export function* walk(root, { exts, exclude = [], sort = false }) {
  if (fs.statSync(root).isFile()) {
    yield root;
    return;
  }
  const real = fs.realpathSync(root);
  const inside = real.endsWith(path.sep) ? real : real + path.sep;
  function* dir(p) {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    if (sort) entries.sort(byName);
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(p, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !exclude.includes(entry.name)) yield* dir(full);
      } else if (exts.has(path.extname(entry.name))) {
        if (fs.realpathSync(full).startsWith(inside)) yield full;
      }
    }
  }
  yield* dir(root);
}
