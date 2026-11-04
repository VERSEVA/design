/**
 * Command bar logic: filtering, group order, ask detection and wrapping
 * selection. Pure and React-free, so node --test imports it directly
 * (erasable TypeScript only).
 */

export interface CommandLike {
  group: string;
  label: string;
  /** Extra words that match, e.g. ['client'] on "Kestrel Co". */
  keywords?: string[];
  disabled?: boolean;
}

export interface AskOption { kind: 'ask'; index: number; question: string; disabled?: false }
export interface CommandOption<T extends CommandLike> { kind: 'command'; index: number; command: T; disabled?: boolean }
export type BarOption<T extends CommandLike> = AskOption | CommandOption<T>;
export interface BarSection<T extends CommandLike> { group: string; options: BarOption<T>[] }
export interface BarResult<T extends CommandLike> { sections: BarSection<T>[]; options: BarOption<T>[]; asking: boolean }
export interface AskRule {
  /** True only when the product passed onAsk. */
  canAsk: boolean;
  /** Tab pressed: ask even when commands match. */
  forced?: boolean;
}

export const ASK_GROUP = 'Ask';

/** Leading words that make the query a question, with or without a contraction ("who's"). Whole words only ("whatever" is not one). */
export const QUESTION_WORDS = [
  'what', 'whats', 'how', 'why', 'when', 'where', 'which', 'who', 'whom', 'whose',
  'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'should', 'will', 'would',
];
const QUESTION_WORD = new RegExp(`^(${QUESTION_WORDS.join('|')})('(s|re|ll|d|ve))?(\\s|$)`);

/** Lowercase, accents stripped, curly apostrophes straightened (iOS smart punctuation), whitespace collapsed and trimmed. */
export function normalize(s: string): string {
  return String(s ?? '').replace(/[\u2018\u2019\u02bc]/g, "'").normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isQuestion(query: string): boolean {
  const q = normalize(query);
  if (!q) return false;
  return q.endsWith('?') || QUESTION_WORD.test(q);
}

/** Every word of the query appears in the label, the group or a keyword. */
export function matches(cmd: CommandLike, query: string): boolean {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = normalize([cmd.label, cmd.group, ...(cmd.keywords ?? [])].join(' '));
  return words.every((w) => hay.includes(w));
}

export function filterCommands<T extends CommandLike>(commands: T[], query: string): T[] {
  return Array.isArray(commands) ? commands.filter((c) => matches(c, query)) : [];
}

/** Groups in the order they first appear in the commands list. */
export function groupOrder(commands: CommandLike[]): string[] {
  const out: string[] = [];
  for (const c of commands ?? []) if (!out.includes(c.group)) out.push(c.group);
  return out;
}

/** The Ask row shows for a question, on Tab, or when nothing matches; never without onAsk or on an empty query. */
export function shouldAsk(query: string, hitCount: number, rule: AskRule): boolean {
  if (!rule.canAsk || !normalize(query)) return false;
  return Boolean(rule.forced) || isQuestion(query) || hitCount === 0;
}

/** The listbox content: the Ask row first in its own group, then matches grouped in first-appearance order. */
export function buildSections<T extends CommandLike>(commands: T[], query: string, rule: AskRule): BarResult<T> {
  const hits = filterCommands(commands, query);
  const asking = shouldAsk(query, hits.length, rule);
  const sections: BarSection<T>[] = [];
  const options: BarOption<T>[] = [];
  if (asking) {
    const ask: AskOption = { kind: 'ask', index: 0, question: String(query).trim() };
    options.push(ask);
    sections.push({ group: ASK_GROUP, options: [ask] });
  }
  for (const group of groupOrder(hits)) {
    const list: BarOption<T>[] = [];
    for (const command of hits) {
      if (command.group !== group) continue;
      const o: CommandOption<T> = { kind: 'command', index: options.length, command, disabled: command.disabled === true };
      options.push(o);
      list.push(o);
    }
    sections.push({ group, options: list });
  }
  return { sections, options, asking };
}

/** Matching commands, never the Ask row: what the results count reads. */
export function resultCount<T extends CommandLike>(result: BarResult<T>): number {
  return result.options.filter((o) => o.kind === 'command').length;
}

/** Next selectable index from current by delta, wrapping and skipping disabled options; -1 when none. */
export function moveSelection(current: number, delta: number, options: ReadonlyArray<{ disabled?: boolean }>): number {
  const n = options?.length ?? 0;
  if (!n) return -1;
  const step = delta < 0 ? -1 : 1;
  let i = Number.isInteger(current) && current >= 0 && current < n ? current : step > 0 ? -1 : n;
  for (let k = 0; k < n; k++) {
    i = (i + step + n) % n;
    if (!options[i].disabled) return i;
  }
  return -1;
}

export function firstSelectable(options: ReadonlyArray<{ disabled?: boolean }>): number {
  return moveSelection(-1, 1, options);
}

export function isAsyncIterable(x: unknown): x is AsyncIterable<string> {
  return typeof x === 'object' && x !== null && typeof (x as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function';
}
