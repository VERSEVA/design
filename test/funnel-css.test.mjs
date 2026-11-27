// Issue 217. The step funnel rules are a port of the approved prototype (plans/proto-1.8-studio-parts,
// proposed.css, 1.A step rows). Each rule is held here string for string, so a later edit to the funnel
// is a visible change to this list, not a drift from what the owner approved. One change, made in
// review of PR 231: the four tile rules read .wtile-body>.funnel where the prototype wrote .wtile .funnel,
// so a panel inside a tile (every studio specimen) keeps its tracks.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "components.css"), "utf8");

const PORTED = [
  ".funnel{container-type:inline-size;list-style:none;margin:0;padding:0;display:grid;gap:var(--s-2)}",
  ".funnel>li{display:grid;grid-template-columns:minmax(0,9rem) minmax(2.5rem,1fr) 3.5rem 9.5rem;grid-template-areas:\"label track count drop\";align-items:center;column-gap:var(--s-3);min-height:24px}",
  ".funnel[data-share]>li{grid-template-columns:minmax(0,10rem) minmax(3rem,1fr) 3.5rem 4.5rem 9.5rem;grid-template-areas:\"label track count share drop\"}",
  ".funnel .hlabel{grid-area:label;width:auto}",
  ".funnel .htrack{grid-area:track}",
  ".funnel .hcount{grid-area:count;width:auto}",
  ".funnel-head{font-size:12px;font-weight:600;color:var(--text-2);white-space:nowrap}",
  ".funnel-head>:nth-child(n+3){text-align:right}",
  ".funnel-share{grid-area:share;text-align:right;font-size:12.5px;color:var(--text-2);font-variant-numeric:tabular-nums}",
  ".funnel-drop{grid-area:drop;display:inline-flex;align-items:center;justify-content:flex-end;gap:var(--s-2);font-size:12.5px;color:var(--text-2);font-variant-numeric:tabular-nums;white-space:nowrap}",
  ".funnel-drop[data-biggest]{color:var(--text-1);font-weight:600}",
  ".funnel-drop .badge{font-weight:600}",
  "@container (max-width:34rem){",
  ".funnel[data-share]>li{grid-template-columns:minmax(0,1fr) auto auto auto;grid-template-areas:\"label share drop count\" \"track track track track\";row-gap:var(--s-1)}",
  ".funnel[data-share]>.funnel-head{display:none}",
  "}",
  "@container (max-width:26rem){",
  ".funnel>li,.funnel[data-share]>li{grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:\"label drop count\" \"track track track\";row-gap:var(--s-1)}",
  ".funnel-share,.funnel-head{display:none}",
  ".wtile-body>.funnel>li{grid-template-areas:\"label drop count\";row-gap:0}",
  ".wtile-body>.funnel .htrack{display:none}",
  "}",
  ".wtile-body>.funnel{gap:var(--s-1)}",
  ".wtile-body>.funnel>li{min-height:20px}"
];

test("components.css carries every prototype funnel rule verbatim, in order", () => {
  let from = 0;
  for (const rule of PORTED) {
    const at = css.indexOf(rule, from);
    assert.ok(at >= 0, `missing or out of order: ${rule}`);
    from = at + rule.length;
  }
});

test("the funnel adds four classes and no column funnel", () => {
  const names = new Set([...css.matchAll(/\.(funnel[\w-]*)/g)].map((m) => m[1]));
  assert.deepEqual([...names].sort(), ["funnel", "funnel-drop", "funnel-head", "funnel-share"]);
});
