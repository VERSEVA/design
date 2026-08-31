# VERSEVA Design

The signature design system of [VERSEVA](https://verseva.com): soft-glass material, one
energetic red accent, a fourteen-law canon, and a four-gate pipeline that enforces it.
Two CSS files, no build step. MIT.

```sh
npm i @verseva/design
```

```html
<link rel="stylesheet" href="node_modules/@verseva/design/tokens.css">
<link rel="stylesheet" href="node_modules/@verseva/design/components.css">
```

Consumer surfaces boot light (`<html data-theme="light">`); consoles run the dark
default. `templates/starter.html` is a working single-file starting point.

## What's in the box

| Path | What |
|---|---|
| `tokens.css` | The signature: color ladders, one accent, type trio, 4px spacing scale, radius posture, elevation, motion, data-viz ladder. Dark default, one light flip block, `[data-brand]` theming |
| `components.css` | The component contract: buttons, fields, cards, tables, badges, toasts, modals, chips, stats, charts, the navshell. Every contract state ships |
| `tailwind.css` / `preset` | The Tailwind bridge for utility-first stacks |
| `bin/` | The gate suite (below) |
| `docs/` | The laws, token reference, component contract, theming guide |
| `templates/starter.html` | Delete the copy, keep the bones |

Component documentation with live specimens and copyable snippets, plus a gallery of
fully interactive example sites (a Three.js hero among them), lives in `site/` and at
verseva.design.

## The gate suite

Taste here is enforced, not hoped for. Four gates, one argument set; exit 0 ships:

```sh
npx verseva-gate --tokens node_modules/@verseva/design/tokens.css src
```

| Gate | Fails on | Exception |
|---|---|---|
| `verseva-hex-gate` | Any hex not drawn from tokens | `hex-ok` + reason |
| `verseva-contrast-gate` | A token pair below 4.5:1 body / 3:1 parts, in any theme or `[data-brand]` block, alpha composited | none: craft law |
| `verseva-spacing-gate` | Inline margin/padding/gap (the seam law), multi-line JSX style objects included | `sp-ok` + reason |
| `verseva-type-gate` | Off-token faces, sizes below 9.5px, `font:` shorthand included | `type-ok` + reason |

Wire it into your build:

```json
{
  "gate": "verseva-gate --tokens node_modules/@verseva/design/tokens.css --tokens src/theme.css src",
  "build": "npm run gate && next build"
}
```

## The laws, shortest form

1. One accent, matte. An accent that is everywhere is not an accent.
2. Mono is for machines. Everything a human reads is body type.
3. Sections must breathe. Space comes from the scale, never inline margins.
4. Hierarchy from fill, not size. Equal-sized pairs; the fill says which leads.
5. No hand-picked hexes. Every color comes from tokens; the gates decide.

The full fourteen, dated and amended in the open, live in [`docs/laws.md`](docs/laws.md).

## Theming

Brands re-value the same roles in one `[data-brand="slug"]` block; structure never
changes, and the contrast gate measures every brand block as its own theme. Recipe in
[`docs/theming.md`](docs/theming.md). Appearance (`data-theme`) and brand accent are
independent axes.

## Credit

Finished work built on the system may carry the line, in the display face with the
accent full stop:

**Built on VERSEVA Design.**

MIT © Verseva Services Corp
