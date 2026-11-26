/**
 * The contract class set, read from components.css at run time (no build
 * step). The recipe gate asks two things of it:
 *
 * - contractClasses(): every class name a selector in components.css names.
 * - contractParts(): the parent parts, the classes whose descendants the
 *   contract styles as bare elements. `any` is the fixed floor; the keyed
 *   sets are read from every ".part <element>" rule, per element, so a part
 *   that styles its buttons does not cover an input.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_CSS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'components.css');

/* Elements the contract owns. role="button" and role="dialog" count as theirs. */
export const OWNED = ['button', 'table', 'input', 'textarea', 'select', 'dialog'];

/* The floor of parent parts, whatever the element inside them. */
export const PART_FLOOR = ['seg', 'tabs', 'chips', 'menu', 'pick', 'switcher', 'field', 'sel', 'switch'];

const CLASS_RE = /\.([a-zA-Z_-][\w-]*)/g;

/* Selector preludes only: comments, declarations, at-rule heads and keyframe steps dropped. */
function selectors(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of clean.matchAll(/([^{}]+)\{/g)) {
    const prelude = m[1].slice(m[1].lastIndexOf(';') + 1).trim();
    if (!prelude || prelude.startsWith('@') || /^(from|to|[\d.]+%)/.test(prelude)) continue;
    out.push(prelude.replace(/\[[^\]]*\]/g, ''));
  }
  return out;
}

export function contractClasses(file = DEFAULT_CSS) {
  const classes = new Set();
  for (const sel of selectors(fs.readFileSync(file, 'utf8'))) {
    for (const m of sel.matchAll(CLASS_RE)) classes.add(m[1]);
  }
  return classes;
}

export function contractParts(file = DEFAULT_CSS) {
  const parts = { any: new Set(PART_FLOOR) };
  for (const tag of OWNED) parts[tag] = new Set();
  for (const sel of selectors(fs.readFileSync(file, 'utf8'))) {
    /* Functional pseudo-classes only filter; drop them so their commas and spaces do not split. */
    const flat = sel.replace(/:[\w-]+\((?:[^()]|\([^()]*\))*\)/g, '');
    for (const part of flat.split(',')) {
      const compounds = part.trim().split(/[\s>+~]+/).filter(Boolean);
      compounds.forEach((compound, i) => {
        const tag = compound.match(/^[a-z]+/)?.[0];
        if (!OWNED.includes(tag)) return;
        for (const before of compounds.slice(0, i)) {
          const lead = before.match(/^\.([a-zA-Z_-][\w-]*)/);
          if (lead) parts[tag].add(lead[1]);
        }
      });
    }
  }
  return parts;
}
