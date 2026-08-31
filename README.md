# VERSEVA Design

[![npm](https://img.shields.io/npm/v/%40verseva%2Fdesign?color=E8352E&label=%40verseva%2Fdesign)](https://www.npmjs.com/package/@verseva/design)
[![gates](https://github.com/verseva/design/actions/workflows/gates.yml/badge.svg)](https://github.com/verseva/design/actions/workflows/gates.yml)
[![license](https://img.shields.io/badge/license-MIT-white)](LICENSE)

The signature design system of [VERSEVA](https://verseva.com): soft-glass material, one
energetic red accent, a fourteen-law canon, and a four-gate pipeline that enforces it.
Two CSS files, no build step. MIT.

[![The VERSEVA Design site](https://raw.githubusercontent.com/verseva/design/main/docs/media/site-home.png)](https://design.verseva.com)

Docs, live specimens, and every example below run at
**[design.verseva.com](https://design.verseva.com)**.

```sh
npm i @verseva/design
```

```html
<link rel="stylesheet" href="node_modules/@verseva/design/tokens.css">
<link rel="stylesheet" href="node_modules/@verseva/design/components.css">
```

Consumer surfaces boot light (`<html data-theme="light">`); consoles run the dark
default. `templates/starter.html` is a working single-file starting point.

## The chapters

Every chapter is preview-first: live specimens, a Show code toggle, snippets
extracted from the specimens themselves so the docs cannot drift.

<table>
  <tr>
    <td width="50%">
      <a href="https://design.verseva.com/components.html"><img src="https://raw.githubusercontent.com/verseva/design/main/docs/media/site-components.png" alt="Components: live specimens with Show code"></a>
      <p align="center"><b>Components</b> · the contract, every state, copy the code</p>
    </td>
    <td width="50%">
      <a href="https://design.verseva.com/data-viz.html"><img src="https://raw.githubusercontent.com/verseva/design/main/docs/media/site-dataviz.png" alt="Data viz: numbers on marks, live two-series chart"></a>
      <p align="center"><b>Data viz</b> · numbers on the marks, axes are a luxury</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <a href="https://design.verseva.com/motion.html"><img src="https://raw.githubusercontent.com/verseva/design/main/docs/media/site-motion.png" alt="Motion: live curve race, replayable demos, theme wipe"></a>
      <p align="center"><b>Motion</b> · enter decelerating, exit accelerating, attention is finite</p>
    </td>
    <td width="50%">
      <a href="https://design.verseva.com/distribute.html"><img src="https://raw.githubusercontent.com/verseva/design/main/docs/media/site-distribute.png" alt="Distribute: CLI, registries, agents, themes"></a>
      <p align="center"><b>Distribute</b> · the CLI, your registries, agents with proof</p>
    </td>
  </tr>
</table>

## The gallery

Fully coded, fully interactive example sites. Every one passes the four gates; every
one is one command away: `npx verseva block add <name>`.

<table>
  <tr>
    <td width="50%">
      <a href="https://design.verseva.com/examples/pulse.html"><img src="https://raw.githubusercontent.com/verseva/design/main/docs/media/site-pulse.png" alt="Pulse: the analytics console"></a>
      <p align="center"><b>Pulse</b> · the viz kit assembled, crosshair hover, range toggle</p>
    </td>
    <td width="50%">
      <a href="https://design.verseva.com/examples/launch.html"><img src="https://raw.githubusercontent.com/verseva/design/main/docs/media/site-launch.png" alt="Launch: the motion kit assembled"></a>
      <p align="center"><b>Launch</b> · line reveal, rolling stats, magnetic CTA, theme wipe</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <a href="https://design.verseva.com/examples/three-hero.html"><img src="https://raw.githubusercontent.com/verseva/design/main/docs/media/site-three-hero.png" alt="Three.js hero reading the tokens at runtime"></a>
      <p align="center"><b>Signal Foundry</b> · a Three.js hero reading the tokens at runtime</p>
    </td>
    <td width="50%">
      <a href="https://design.verseva.com/examples/console.html"><img src="https://raw.githubusercontent.com/verseva/design/main/docs/media/site-console.png" alt="Ops console with live search and sortable table"></a>
      <p align="center"><b>Ops console</b> · live search, sortable table, count-up stats</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <a href="https://design.verseva.com/examples/store.html"><img src="https://raw.githubusercontent.com/verseva/design/main/docs/media/site-store.png" alt="Storefront on the light theme with a working cart"></a>
      <p align="center"><b>Redline Supply</b> · the light theme, a working cart</p>
    </td>
    <td width="50%">
      <a href="https://design.verseva.com/examples.html"><img src="https://raw.githubusercontent.com/verseva/design/main/docs/media/site-gallery.png" alt="The gallery: eight live mock sites with preview and code"></a>
      <p align="center"><b>The gallery</b> · all eight, live previews, code one click away</p>
    </td>
  </tr>
</table>

## React, source-distribution

The shadcn model, held to the signature: components land in YOUR project as typed,
dependency-free source you own, and the gate suite can prove the result stayed
on-signature, which is the part no other system does.

```sh
npx verseva init
npx verseva add button field toast console-nav viz motion
npx verseva block add pulse
npx verseva list
```

`add` resolves dependencies and refuses nothing you can't edit; `block add` copies a
full working page with its css hrefs pointed at `node_modules`. The registry is
`registry.json` in this package; every listed file ships in the tarball.

`add` also takes `@namespace/item` (mapped in `verseva.json` under `registries`),
full URLs, and local `.json` item files, and `npx verseva build` flattens YOUR
registry into hostable per-item JSON so anyone can distribute on the same rails.
Contained by construction: written names flatten to basenames, symlink destinations
are refused, only source extensions install, fetched items must embed content, deps
stay on their item's origin, and registries are https-only.

## Agents

```sh
npx verseva mcp init --client claude   # cursor | vscode
```

One zero-dependency stdio server. The agent can list the registry, read any
component's source, read the tokens and the laws, install components, and run
the full gate suite with `run_gate` to PROVE its output stayed on-signature
before calling anything done. No other design system gives an agent proof.

## Themes

Four accent presets ship gate-proven across all four theme axes (base and brand,
dark and light): `cobalt`, `forest`, `violet`, `slate`.

```sh
npx verseva theme add cobalt
```

Link it after `tokens.css`, set `<html data-brand="cobalt">`. One accent, matte
(law 3): a preset re-values the accent axis only.

## What's in the box

| Path | What |
|---|---|
| `tokens.css` | The signature: color ladders, one accent, type trio, 4px spacing scale, radius posture, elevation, motion, data-viz ladder. Dark default, one light flip block, `[data-brand]` theming |
| `components.css` | The component contract: buttons, fields, cards, tables, badges, toasts, modals, chips, stats, the viz kit, the motion kit, the navshell, plus scale-mapped spacing utilities (`mt-5`, `pb-4`, `gap-3`). Every contract state ships |
| `tailwind.css` / `preset` | The Tailwind bridge for utility-first stacks |
| `bin/` | The gate suite (below) |
| `docs/` | The laws, token reference, component contract, theming guide |
| `templates/starter.html` | Delete the copy, keep the bones |

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
