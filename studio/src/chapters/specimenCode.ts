// A specimen's code sample from its own rendered markup, for chapters whose specimens are the
// source of truth (data-viz since 1.7.0): every element on its own line at two spaces a level,
// an element holding only text on one line, attributes as rendered. The same input gives the
// same text, so studio/test/specimen-code.test.tsx can hold the committed samples byte for byte.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const text = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function open(el: Element): string {
  const attrs = [...el.attributes].map((a) => (a.value === '' ? ` ${a.name}` : ` ${a.name}="${esc(a.value)}"`)).join('');
  return `<${el.localName}${attrs}>`;
}

function lines(node: Node, depth: number, out: string[]) {
  const pad = '  '.repeat(depth);
  if (node.nodeType === 3) {
    const t = node.textContent!.replace(/\s+/g, ' ').trim();
    if (t) out.push(pad + text(t));
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as Element;
  if (VOID.has(el.localName)) { out.push(pad + open(el)); return; }
  const kids = [...el.childNodes].filter((n) => n.nodeType === 1 || (n.nodeType === 3 && n.textContent!.trim()));
  if (kids.every((n) => n.nodeType === 3)) {
    out.push(`${pad}${open(el)}${text(el.textContent!.replace(/\s+/g, ' ').trim())}</${el.localName}>`);
    return;
  }
  out.push(pad + open(el));
  kids.forEach((k) => lines(k, depth + 1, out));
  out.push(`${pad}</${el.localName}>`);
}

/** The specimen's children as a code sample. */
export function specimenCode(spec: Element): string {
  const out: string[] = [];
  spec.childNodes.forEach((n) => lines(n, 0, out));
  return out.join('\n');
}
