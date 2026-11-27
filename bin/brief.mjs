/**
 * Agent briefs: one registry component with the laws that bind it and its contract section.
 * Shared by `verseva brief <name>` (bin/cmd-brief.mjs) and the MCP tool get_brief, so the two
 * return the same text. Not a command module: the name does not match cmd-*.mjs.
 *
 * The registry carries law numbers and a heading anchor only. Law text and the contract
 * section (its bans included) are read from docs/ at call time, never copied into the registry.
 * Input is a registry name and nothing else: no path, no URL, no flag.
 */
import fs from 'node:fs';
import path from 'node:path';

/** The GitHub heading anchor: lowercase, punctuation dropped, each space a hyphen. */
export function slug(heading) {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}

/** Headings outside code fences, each with its anchor and its body up to the next heading of any level. */
export function headings(md) {
  const lines = md.split('\n');
  const found = [];
  let fence = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) return;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) found.push({ level: m[1].length, text: m[2], anchor: slug(m[2]), line: i });
  });
  return found.map((h, k) => {
    const end = k + 1 < found.length ? found[k + 1].line : lines.length;
    return { ...h, body: lines.slice(h.line + 1, end).join('\n').trim() };
  });
}

/** The numbered laws: `N. **...` items and their indented continuation lines, keyed by number. */
export function parseLaws(md) {
  const laws = new Map();
  let current = null;
  for (const line of md.split('\n')) {
    const m = /^(\d+)\.\s/.exec(line);
    if (m) {
      current = Number(m[1]);
      laws.set(current, [line]);
    } else if (current !== null && /^\s+\S/.test(line)) {
      laws.get(current).push(line);
    } else {
      current = null;
    }
  }
  return new Map([...laws].map(([n, ls]) => [n, ls.join('\n')]));
}

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LAWS_DOC = 'docs/laws.md';
const CONTRACT_DOC = 'docs/component-contract.md';

/** A code fence longer than any backtick run in the source, so the source cannot close it. */
function fenced(source, lang) {
  const longest = Math.max(2, ...[...source.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${lang}\n${source}${source.endsWith('\n') ? '' : '\n'}${fence}`;
}

/**
 * The brief for one registry component, or one error line. Validates before any lookup:
 * a string, a registry-name shape (no path, URL or flag can pass), an exact registry match,
 * kind component. Every law and the anchor must resolve, or nothing is returned but the error.
 */
export function buildBrief(pkgRoot, registry, name) {
  if (typeof name !== 'string') return { error: 'refused: name must be a string naming a registry component' };
  if (name.length > 64 || !NAME.test(name)) {
    /* Shown as printable ASCII only: a line or paragraph separator in the input cannot split the line. */
    const shown = JSON.stringify(name.slice(0, 64).replace(/[^\x20-\x7e]/g, '?'));
    return { error: `refused: ${shown} is not a registry name (lowercase letters, digits and hyphens; no paths or URLs)` };
  }
  const comp = registry.components.find((c) => c.name === name);
  if (!comp) return { error: `unknown component: ${name} (try: verseva list)` };
  if (comp.kind !== 'component') return { error: `not a component: ${name} is a ${comp.kind}; briefs cover kind: component entries` };

  const bad = (why) => ({ error: `registry is inconsistent: ${name} ${why}` });
  /* Real paths on both sides, and no symlink at the file itself: a link is never followed,
     wherever it points, and a link in a parent directory cannot carry the read outside. */
  const root = fs.realpathSync(pkgRoot);
  const shown = JSON.stringify(comp.file);
  const file = path.resolve(root, comp.file);
  let st;
  try { st = fs.lstatSync(file); } catch { return bad(`file ${shown} does not exist`); }
  if (st.isSymbolicLink()) return bad(`file ${shown} is a symlink; briefs read regular files only`);
  if (!fs.realpathSync(file).startsWith(root + path.sep)) return bad(`file ${shown} resolves outside the package`);
  if (!Array.isArray(comp.laws) || comp.laws.length === 0) return bad('names no laws');
  if (typeof comp.contract !== 'string') return bad('names no contract anchor');

  const laws = parseLaws(fs.readFileSync(path.join(root, LAWS_DOC), 'utf8'));
  const missing = comp.laws.find((n) => !laws.has(n));
  if (missing !== undefined) return bad(`names law ${JSON.stringify(missing)}, which ${LAWS_DOC} does not have`);
  const matches = headings(fs.readFileSync(path.join(root, CONTRACT_DOC), 'utf8')).filter((h) => h.anchor === comp.contract);
  if (matches.length !== 1) return bad(`contract anchor #${comp.contract} matches ${matches.length} headings in ${CONTRACT_DOC}`);
  const section = matches[0];
  const source = fs.readFileSync(file, 'utf8');

  const text = [
    `# Brief: ${name}`,
    '',
    comp.description,
    '',
    `Laws: ${comp.laws.join(', ')}`,
    `Contract: ${CONTRACT_DOC}#${comp.contract}`,
    `Deps: ${comp.deps.length ? `${comp.deps.join(', ')} (add them too)` : 'none'}`,
    '',
    `## Source: ${comp.file}`,
    '',
    fenced(source, path.extname(comp.file).slice(1)),
    '',
    `## Laws (${LAWS_DOC})`,
    '',
    ...comp.laws.flatMap((n) => [`### Law ${n}`, '', laws.get(n), '']),
    `## Contract: ${section.text}`,
    '',
    section.body,
    '',
    '## Gate',
    '',
    'Done means the gate suite passes on what you built: the MCP tool run_gate, or `npx verseva-gate --tokens node_modules/@verseva/design/tokens.css <paths>` exiting 0.',
    '',
  ].join('\n');
  return { text };
}
