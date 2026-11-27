/**
 * The contract class set, read from components.css at run time (no build
 * step). The recipe gate asks two things of it:
 *
 * - contractClasses(): every root part class. A root class leads a compound
 *   in some selector (".btn", ".menu-item", ".field"). A modifier that only
 *   ever rides on another class (".btn.sm") is not one, and neither are the
 *   spacing utilities or .sr-only: a utility-built element can carry those
 *   and still be built by hand.
 * - contractParts(): the parent parts, keyed per element. A fixed floor,
 *   plus every ".part <element>" rule in components.css, so a part that
 *   styles its buttons does not cover an input.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_CSS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'components.css');
const TOKENS_CSS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tokens.css');

/* Elements the contract owns. role="button" and role="dialog" count as theirs. */
export const OWNED = ['button', 'table', 'input', 'textarea', 'select', 'dialog'];

/* The floor of parent parts, per element. Every name is a class components.css ships (a test holds that). */
export const PART_FLOOR = {
  button: ['seg', 'menu', 'switcher', 'pick'],
  input: ['field', 'sel', 'pick', 'switch'],
  textarea: ['field'],
  select: ['field'],
};

/* Classes a hand-built element can carry without being a contract part. */
const UTILITY_RE = /^(?:(?:mt|mb|pt|pb|gap)-\d+|sr-only)$/;

const FN_PSEUDO = '\\((?:[^()]|\\([^()]*\\))*\\)';

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

/* The compounds of one selector list, as arrays in source order. :is() and :where() style what
   they list, so their contents are read as selectors of their own; every other functional
   pseudo-class only filters and is dropped. */
function compoundLists(sel) {
  const lifted = [];
  const flat = sel
    .replace(new RegExp(`:(?:is|where)${FN_PSEUDO}`, 'g'), (m) => { lifted.push(m.slice(m.indexOf('(') + 1, -1)); return ''; })
    .replace(new RegExp(`:[\\w-]+${FN_PSEUDO}`, 'g'), '');
  const lists = flat.split(',').map((part) => part.trim().split(/[\s>+~]+/).filter(Boolean));
  for (const inner of lifted) lists.push(...compoundLists(inner));
  return lists;
}

/* The class a compound leads with. A class on an element selector ("a.active") is a state of that element, not a part. */
const leadClass = (compound) => compound.match(/^\.([a-zA-Z_-][\w-]*)/)?.[1];

/* The material token names: every --glass-*, --nav-* and --accent-bloom that tokens.css defines,
   read at run time, so a project's own --nav-height is not one. --e-* is not material: the
   Tailwind bridge maps every shadow utility to it. */
export const MATERIAL_TOKENS = [...new Set(
  [...fs.readFileSync(TOKENS_CSS, 'utf8').matchAll(/(?:^|[;{\s])--((?:glass|nav)-[\w-]+|accent-bloom)\s*:/g)].map((m) => m[1]),
)].sort();

/* A reference to a material token. A declaration (a ban nulling a token) is not a reference. */
export const MATERIAL_RE = new RegExp(`var\\(\\s*--(?:${MATERIAL_TOKENS.join('|')})(?![\\w-])`);

/* Innermost rules: selector prelude and declaration block. Comments, at-rule heads and keyframe steps dropped. */
function rules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const prelude = m[1].slice(m[1].lastIndexOf(';') + 1).trim();
    if (!prelude || prelude.startsWith('@') || /^(from|to|[\d.]+%)/.test(prelude)) continue;
    out.push({ selector: prelude.replace(/\[[^\]]*\]/g, ''), body: m[2] });
  }
  return out;
}

/* Root part classes whose rules consume material: every root class a compound of the rule's
   selector leads with, so ".snav a.active" counts .snav and ".tab.on" counts .tab. */
export function materialClasses(file = DEFAULT_CSS) {
  const roots = contractClasses(file);
  const found = new Set();
  for (const { selector, body } of rules(fs.readFileSync(file, 'utf8'))) {
    if (!MATERIAL_RE.test(body)) continue;
    for (const compounds of compoundLists(selector)) {
      for (const compound of compounds) {
        const lead = leadClass(compound);
        if (lead && roots.has(lead)) found.add(lead);
      }
    }
  }
  return found;
}

/* The material rules as the census matches them: one entry per selector of a rule that consumes
   material, each a list of compounds, each the classes that compound requires ("tab.on" needs
   both). Compounds with no class are dropped; a selector counts only when it names a root part. */
export function materialSelectors(file = DEFAULT_CSS) {
  const roots = contractClasses(file);
  const seen = new Map();
  for (const { selector, body } of rules(fs.readFileSync(file, 'utf8'))) {
    if (!MATERIAL_RE.test(body)) continue;
    for (const compounds of compoundLists(selector)) {
      if (!compounds.some((c) => roots.has(leadClass(c)))) continue;
      const need = compounds.map((c) => [...c.matchAll(/\.([a-zA-Z_-][\w-]*)/g)].map((m) => m[1])).filter((l) => l.length);
      seen.set(need.map((l) => l.join('.')).join(' '), need);
    }
  }
  return [...seen.values()];
}

/* Whether a stylesheet defines the material (a vendored components.css): a rule that consumes
   material under a selector led by a material class. Such a file is a definition, not a use. */
export function definesMaterial(css, material = materialClasses()) {
  return rules(css).some(({ selector, body }) => MATERIAL_RE.test(body)
    && compoundLists(selector).some((compounds) => compounds.some((c) => material.has(leadClass(c)))));
}

export function contractClasses(file = DEFAULT_CSS) {
  const classes = new Set();
  for (const sel of selectors(fs.readFileSync(file, 'utf8'))) {
    for (const compounds of compoundLists(sel)) {
      for (const compound of compounds) {
        const lead = leadClass(compound);
        if (lead && !UTILITY_RE.test(lead)) classes.add(lead);
      }
    }
  }
  return classes;
}

export function contractParts(file = DEFAULT_CSS) {
  const parts = {};
  for (const tag of OWNED) parts[tag] = new Set(PART_FLOOR[tag] ?? []);
  for (const sel of selectors(fs.readFileSync(file, 'utf8'))) {
    for (const compounds of compoundLists(sel)) {
      compounds.forEach((compound, i) => {
        const tag = compound.match(/^[a-z]+/)?.[0];
        if (!OWNED.includes(tag)) return;
        for (const before of compounds.slice(0, i)) {
          const lead = leadClass(before);
          if (lead) parts[tag].add(lead);
        }
      });
    }
  }
  return parts;
}
