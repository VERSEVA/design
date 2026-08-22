# @verseva/design-core

The VERSEVA design signature as an installable package: tokens, component contract, Tailwind
bridge, design board, and the hex gate that fails builds on hand-picked colors. Private;
installed per project via git.

| File | What |
|---|---|
| `tokens.css` | The signature: craft roles + soft-glass material, dark default + one light flip block |
| `components.css` | The component contract as framework-light CSS (navshell ported 1:1) |
| `tailwind.css` | Tailwind v4 bridge (`@theme inline` role mapping) |
| `tailwind.preset.cjs` | Tailwind v3 preset |
| `bin/hex-gate.mjs` | `verseva-hex-gate`: build fails on any hex not drawn from tokens |
| `docs/` | `tokens.md` · `component-contract.md` · `laws.md` · `theming.md` |
| `board/` | The design board (the render of this package; `npm run board` pulls brand themes + serves) |

## Install

```bash
npm i -D git+ssh://git@github.com/xhunn/verseva-design-core.git
```

## Use

```css
/* Tailwind v4 project */
@import "tailwindcss";
@import "@verseva/design-core/tailwind.css";
```

```css
/* Any other surface */
@import "@verseva/design-core/tokens.css";
@import "@verseva/design-core/components.css";
```

Brand themes override values via `[data-brand]` blocks and live with the brand, not here:
`docs/theming.md`. Owned surfaces carry the full signature; partner surfaces carry the craft cut
(skeleton, laws, floors) with client values and no credit line.

## Enforce

```bash
verseva-hex-gate --tokens node_modules/@verseva/design-core/tokens.css [--tokens theme.css] src
```

Exit 1 lists `file:line #hex` for every color not drawn from tokens. `hex-ok` on a line marks a
ratified exception. Wire it before `build`.

## Rules of the repo

- `tokens.css` + `docs/*.md` are the source; the board is the render; divergence is a defect.
- Roles are fixed. New roles land here for every brand or not at all. Values change by
  ratification.
- Zero visual change was the extraction constraint (2026-08-22); diffs against the pre-package
  Baseline are defects.
