# Changelog

## 1.2.0 · 2026-10-22

### Fixed

- **Law 4: human labels are body, not mono.** `.table th` and `.grouplabel` shipped as
  uppercase, letter-spaced mono, which law 4 (mono is for machines) forbids for anything a
  human reads. Both are now the `label` role: 12px/600 sentence-case sans in `--text-2`, no
  tracking. Same fix on the site's `.ttable` headers and spec labels and the launch block's
  kicker; `docs/tokens.md` redefines the `label` role to match. Visible change for every
  consumer of the table and console nav.
- **`--text-3` contrast and its gate.** `--text-3` sets reading text (meta lines, captions,
  help, chart labels) but measured 3.5 to 4.0:1 while `verseva-contrast-gate` checked it at
  3:1. Lifted to the smallest values that clear 4.5:1 on bg, surface and surface-2: dark
  `#6B7280` to `#7A818E` (4.96 / 4.74 / 4.52), light `#7A828F` to `#686F7D` (4.63 / 5.05 /
  4.51). No preset theme re-values it. The gate now holds every reading-text role at 4.5:1:
  `text-3` on bg, surface and surface-2 (surface-2 is new), plus `danger` on surface (error
  help, danger menu items). A new test fails on the 1.1.0 values, so the gate would have
  caught this. The studio's live contrast table reads the same pairs.

### Added

Seven console recipes, promoted from the NEMIXO Studio CRM, each with every contract state
and a studio specimen:

- **Glass panel** `.glass` (+ `.hd`, `.bd`): law 1 material on content panels, no blur.
- **Sidebar active bloom**: `.snav a.active` / `aria-current="page"` now carries the accent
  bloom and glow from `.tab.on` (replaces the flat accent tint); `.snav a` gains
  focus-visible, press and `aria-disabled` states.
- **Row menu with a checked item**: `.menu.inline` trigger, `menuitemradio` /
  `menuitemcheckbox` items with a trailing `.tick`; `.menu.end`, disabled and busy items.
- **Read-only field list** `.kv` (`<dl>`), with `.unset` and skeleton states.
- **Timeline** `.tline` on `.lrows`, icon in the identity slot, `.new` entrance; `a.lrow`
  gains a focus ring.
- **Confirm to erase** `.modal.erase`: typed confirmation, armed only on an exact match.
- **Bulk selection** `.pick` checkbox column, selected-row wash, and the `.bulkbar` toolbar.

- **Pinned list headers.** Contract: long lists (an index, registry, inbox, log or
  import) pin their header row; lists fixed by design do not. New `.pin` wrapper
  pins `thead th` or a `.pin-head` row under the surface's sticky chrome
  (`--sticky-top`), clipping with `overflow: clip` so no ancestor silently becomes
  the sticky container. Below 1024px, or with `.pin.box`, the wrapper is a capped
  scroll box in both axes (`--sticky-bottom` reserves a floating bottom bar).
  Studio specimen: `#table-pin`.

The console example and block now run on these recipes.

## 1.1.0 · 2026-09-01

- **The data-viz kit.** `--data-alt` joins the tokens as the fixed second-series
  hue (validator-proven against the accent in both modes) and enters the contrast
  gate's permanent pairs. Contract: microbar, judged trend, hbars, activity
  strip/calendar, ring (label below the dial), markstrip, chart furniture.
  React: `npx verseva add viz`. New block: `pulse`.
- **The motion kit.** Tokens gain `--ease-exit` (leaving for good) and
  `--ease-back` (snap-back settle). Contract: staggered entrances, masked line
  reveal (JS-gated behind `html.js` so no-JS still reads), pointer spotlight,
  border beam, rolling numbers, sequenced text swap, finite attention ring,
  fr-track grow, marquee, overlay choreography. React: `npx verseva add motion`.
  New block: `launch`.
- **Behavior change: `.modal` and `.ovl.open` now animate their entrance**
  (scrim one beat faster than the panel, enter-only). Consumers of the shipped
  modal get the choreography without markup changes; reduced-motion disables it.
- **One theme control, sitewide.** Every page's toggle is now an icon (sun in
  the dark, moon in the light) that runs the View Transition circle wipe and
  remembers the choice across pages. The VERSEVA mark rides every wordmark and
  crumb as a currentColor SVG. Contract gains `.btn.icon`.

## 1.0.0 · 2026-08-31

The open release. VERSEVA Design goes MIT and public.

- **Open sourced.** License moves to MIT; the package publishes to the public npm
  registry as `@verseva/design`.
- **Accent re-cut to energetic red.** Dark `#E8352E`, light `#C42B21`; the former
  bronze family leaves the signature (it belongs to a sibling brand's theme). Law 3
  amended: saturation is a theme axis, the matte treatment is the law.
- **Fourteen laws.** Laws 7 and 8 amended to the shipped contract under the tokens-win
  ruling (controls 10–14, product cards 14, press = sit-down for bar controls /
  compress for floating); law 13 widened to the gate suite; new law 14, signature
  carriage.
- **The full gate suite.** `verseva-gate` runs four gates with one argument set:
  hex (off-token colors), contrast (4.5:1 / 3:1 floors, both themes and every
  `[data-brand]` block, alpha composited over the real backdrop), spacing (inline
  margin/padding/gap, including multi-line JSX style objects), type (off-token faces,
  sizes below the 9.5px floor, `font:` shorthand included). Each gate also ships
  standalone.
- **React, source-distribution.** A typed, dependency-free React kit
  (`react/`: button, field, switch, card, badge, toast, modal, segmented, chips,
  stat, skeleton, console-nav) delivered shadcn-style: `npx verseva add <name>`
  copies the source into your project, `npx verseva block add <name>` copies a
  full working page, `npx verseva init` wires the imports and the gate script.
  The registry is `registry.json`; blocks are byte-locked to the live gallery by
  test.
- **Navshell v2** (operator ruling): single tier, equal-width tabs, labels always
  visible, constant height; a tab's sub-sections live at the top of its own
  content. **Console navigation in two variants**: flat grouped rows (the NEMIXO
  console model) and an accordion whose collapse is the `hidden` attribute with
  chevron-only motion and whose active group refuses to collapse (the Spectre
  model, mechanics ported 1:1).
- **Distribution rails.** `npx verseva build` flattens the registry into hostable
  per-item JSON; `add` resolves bare names, `@namespace/item` (via `verseva.json`
  registries), URLs, and local item files, with dependency resolution and
  traversal-proof basename writes.
- **`verseva-mcp`.** A zero-dependency stdio MCP server (`npx verseva mcp init`
  wires Claude, Cursor, or VS Code): agents list the registry, read component
  source, read tokens and laws, install components, and run the full gate suite
  via `run_gate` to prove their output, the tool no other design system ships.
- **Theme presets.** `cobalt`, `forest`, `violet`, `slate`: accent-axis presets,
  each contrast-gate proven across all four theme axes (64 pairs), installed via
  `npx verseva theme add <name>`.
- **Component breadth.** Ten new contract components (select + textarea fields,
  tabs, menu, tooltip, breadcrumbs, pagination, progress, callout, empty state,
  content accordion) with React counterparts for the interactive ones.
- **Spacing utilities.** `mt-* / mb-* / pt-* / pb-* / gap-*` mapped straight onto
  the scale (mt-5 = `var(--s-5)`): the seam law as a handrail, so rhythm between a
  control row and its content is never left to memory.
- **Docs, the shadcn bar and past it.** Components page: sticky side nav with
  scrollspy (the pill wall is gone), preview-first with a Show code toggle per
  component, snippets still auto-extracted from the live specimens. Gallery: every
  mock site now carries Open AND Code (a source viewer with copy). Home:
  design.verseva.com.
- **Templates.** `templates/starter.html`: a single-file starting point on the tokens.
- **Docs site.** Guidelines, component documentation with copyable snippets extracted
  from live specimens, and a gallery of interactive example sites (`site/` in the
  repo; design.verseva.com once DNS lands).

## 0.1.1 · 2026-08-22

Initial private release: signature tokens (bronze era), component contract, Tailwind
bridge, hex gate, design board.
