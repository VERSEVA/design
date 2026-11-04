# Changelog

## 1.6.1 · unreleased

### Added

- **design.verseva.com is pre-rendered.** Every route in the studio routes table ships its own HTML: real headings
  without JS, a unique title and description, a canonical on design.verseva.com, Open Graph and Twitter tags, and
  JSON-LD (BreadcrumbList, plus WebSite on home). Pages hydrate in place, and client navigation keeps the whole head
  in step. The SPA rewrites in `vercel.json` are gone: each route is a file.
- **SEO kit, generated at build time** from the emblem and the dark canvas tokens at full clear space: `favicon.ico`,
  `icon.svg`, `apple-touch-icon.png`, 192 and 512 icons plus a maskable one, the `og.png` social card,
  `site.webmanifest`, `robots.txt` and `sitemap.xml` (every route).
- **A studio 404 page.** Unknown paths return 404 with the studio shell and a way back to Overview (noindex).
- **The gallery lives in the studio.** `/gallery` is a native page, and each example opens at `/gallery/<slug>`
  (the example in a frame that fits its document and follows the studio theme and brand) with its source at
  `/gallery/<slug>/code` (pre-rendered, with Copy). Links inside an example route through
  the studio. `/examples/*.html` still serve as files.
- **Components links to Widgets** from its header.
- **Old site links land in the studio.** `/code.html?f=examples/<slug>.html` (and `/site/code.html?f=`) 308s to
  `/gallery/<slug>/code`; any other `code.html` request goes to `/gallery`. Every `/site/<page>.html` 308s to its
  studio route (`/site/index.html` to `/`, `/site/examples.html` to `/gallery`), as the root copies already did. The
  registry JSON (`/r/*`, `/site/r/*`), `/examples/**`, `/site/examples/**`, `site.css` and `theme.js` stay files.

### Fixed

- **Gallery sources load per page, not in the main bundle.** Each `/gallery/<slug>/code` route loads only its own
  example's source as a separate chunk; the pre-rendered page still holds the full text without JS and hydrates with
  it in place. The main entry chunk drops from 176.3 kB to 146.8 kB gzip, held under a 150 kB budget by
  `test/served/bundle.test.mjs`, which also fails if any example source returns to it.
- **The landing example holds at phone width.** Below 600px its nav wraps the section links to their own row, so
  `examples/landing.html` is 375px wide at 375px (was 433px). Unchanged at 1280px.
- **Components no longer scrolls sideways on phones.** The `#table` specimen sits in its `.tscroll` scroller and the
  `#table-pin` specimen lets its `.pin.box` scroll, at 375px.

- **Theme before first paint.** The inline head script runs ahead of every stylesheet, and the Mode control shows the
  stored mode from first paint instead of sliding from System after load.
- **`/<route>/index.html`** opens that route instead of the not-found page.
- **Overview's Pulse and Launch tiles open their gallery pages** (`/gallery/pulse`, `/gallery/launch`) inside the
  studio, instead of the bare example files.

- **What's new New tag spends no accent.** `.badge.bloom` moves from `--accent-bloom` to the text ladder:
  `--text-1` at weight 600 on `--surface-2`, a step above Improved (`--text-2`). Law 3 budget: counts and info
  badges are neutral. The console-view accent test now renders an open What's new drawer.
- **Studio Pause motion stops every auto-moving element (WCAG 2.2.2).** The header control now stops every CSS
  animation on the page and in same-origin example frames (marquee, border beam, spinners, shimmer) and the
  Live now smart stack's rotation, as well as the 3D stage. Reduced motion is unchanged.
- **In-page anchors move focus (WCAG 2.4.1).** Ported chapter anchors, including the skip-link specimens
  (`#sh-main`, `#shr-main`), scroll and focus their target, adding `tabindex="-1"` where it is not focusable.
- **Deep links clear the sticky studio header.** Every studio scroll margin reads one variable,
  `--studio-scroll-pad`, built from the header's and the phone page select's measured heights (191px and 61px at
  375px, 66px at 1280px), with per-breakpoint fallbacks. Cold deep links now land on their section.
- **React 18 consumers: `widget-grid` and `smart-stack` compile and work again.** Both set `inert`, which
  `@types/react` 18 does not know, so `tsc` failed on React 18 projects; React 18 also drops a boolean
  `inert`, so edit mode and hidden stack pages were not inert there. A new registry util, `inert`
  (`react/inert.ts`), renders `inert` on both: `true` on React 19, `""` on React 18. Re-add the two parts
  (`npx verseva add widget-grid smart-stack`, which brings `inert`). Every registry React part now
  type-checks against `@types/react` 18 and 19 in CI, and `package.json` declares React
  `^18.0.0 || ^19.0.0` as an optional peer (the CSS needs no React).
- **Skip to content (WCAG 2.4.1).** Every studio route opens with a "Skip to content" link, the first
  focusable element of the shell, hidden until focused, with the focus ring. It moves focus to the page's
  main content, in the pre-rendered HTML and after hydration.
- **The /widgets console keeps its phone nav.** The Home console specimen carries a `.navshell` below
  900px, where the console hides its sidebar, inside the specimen instead of fixed to the page.
- **Overview's Pulse and Launch covers open without a page reload.** They route through the studio like
  every other studio link.
- **Components and the console example hold at 360px.** The `#bulk` table specimen sits in a `.tscroll`
  scroller (it spilled past its box and scrolled the page sideways below 372px), and
  `examples/console.html` (and `blocks/console.html`) tightens its quotes table cells below 400px
  (366px wide at 360px before).
- **Old `/code.html?f=` links land on a clean URL.** The redirect passed its query through, so the code
  page opened at `/gallery/<slug>/code?f=...`; the studio now drops the stray `f` in place, on any
  gallery route.

## 1.6.0 · 2026-11-04

A widget home, a live activity capsule and a command bar, each as CSS recipes, React parts (`npx verseva add`) and a pure state module, with live specimens at design.verseva.com/widgets. No 1.5 class or token is renamed; two visible changes are listed under Changed and Fixed.

### Added

- **Widget grid `.wgrid` and tile `.wtile[data-size]`.** 4 columns, 2 under 1100px, 1 under 560px; S 1x1, M 2x1,
  L 2x2, XL 4x2, each tile rendering the view for its fitted size (XL drops to L at 2 columns, L and XL to M at 1).
  Glass at `--r-lg`; hover, focus-visible, press, disabled, loading (`.skel` copy), error with Retry, empty grid and
  reduced-motion states. Accent budget: charts in a tile draw on the text ladder; only the one `focus` widget keeps
  the accent.
- **Edit mode.** Rotation-only jiggle, remove with Undo, `aria-pressed` size buttons (sizes that do not fit stay,
  `aria-disabled`), reorder by drag, a touch handle, Move up and Move down, or Alt+Arrow; 44px hit areas; polite
  announcements; Esc leaves.
- **Smart stack `.wstack`** with a visible pause; the timer stops on hover, focus and under reduced motion.
- **Gallery drawer content `.wgal`** for adding widgets.
- **React parts** `widget-grid`, `smart-stack`, `widget-gallery` and the pure `widget-state` (`npx verseva add widget-grid`).
- **New global classes:** `.wgrid`, `.wgrid-empty`, `.wgrid-add`, `.wgrid-undo`, `.wtile`, `.wtile-body`, `.wtile-hd`,
  `.wtile-meta`, `.wtile-num`, `.wtile-sub`, `.wtile-foot`, `.wtile-rows`, `.wtile-row`, `.wtile-val`, `.wtile-skel`,
  `.wtile-skel-num`, `.wtile-skel-plot`, `.wtile-err`, `.wtile-errline`, `.wtile-x`, `.wtile-edit`, `.wtile-handle`,
  `.wtile-sizes`, `.wtile-move`, `.wstack`, `.wstack-pages`, `.wstack-page`, `.wstack-nav`, `.wstack-dot`,
  `.wstack-pause`, `.wstack-step`, `.wgal`, `.wgal-item`, `.wgal-icon`, `.wgal-name`, `.wgal-sizes`. Keyframes: `wtile-jiggle`.
- **Live activity capsule `.lact` and panel `.lact-panel`.** A glass capsule for long jobs in the top bar's
  `.tbar-end`, before the bell: the running job closest to done with its ring and percent, `+n` running. Ring and
  bar are `--text-1` while running, `--success` done, `--danger` on error (no accent). The panel lists every job
  with its step, bar, Cancel, and Retry on error; a bottom sheet under 900px. Done jobs leave after 6 seconds, never
  while the panel is open, and hand off to a notification; errors stay. Polite announcements at start, done, cancel
  and 25% steps; failures as alerts. React: `npx verseva add live-activity` (`activity-state` holds the rules).
  New global classes: `.lact`, `.lact-wrap`, `.lact-ring`, `.lact-track`, `.lact-arc`, `.lact-ti`, `.lact-tx`,
  `.lact-name`, `.lact-pc`, `.lact-more`, `.lact-panel`, `.lact-list`, `.lact-item`, `.lact-top`, `.lact-bar`,
  `.lact-step`, `.lact-err`, `.lact-acts`. New keyframes: `dc-lact-turn`, `dc-lact-slide`.
- **Command bar `.cmdk`** (React `command-bar` + `command-state`). Meta+K / Ctrl+K opens actions,
  go-to and recent items filtered as you type; with `onAsk`, a question becomes an Ask row and the
  answer streams in place, with an optional widget preview and Pin to Home. Listbox semantics,
  focus trap, Escape returns focus, `aria-busy` while streaming and one announcement when done,
  no-results and Ask-failure states, a full-height sheet on phone. Contract: "Command bar".
  New global classes: `.cmdk`, `.cmdk-ovl`, `.cmdk-field`, `.cmdk-input`, `.cmdk-mode`,
  `.cmdk-kbd`, `.cmdk-list`, `.cmdk-group`, `.cmdk-opt` (modifier `.ask`), `.cmdk-label`,
  `.cmdk-hint`, `.cmdk-empty`, `.cmdk-ans`, `.cmdk-q`, `.cmdk-a`, `.cmdk-caret`, `.cmdk-load`,
  `.cmdk-widget`, `.cmdk-acts`, `.cmdk-err`, `.cmdk-ft`, `.cmdk-trigger`, `.cmdk-close`; keyframes `cmdk-in`,
  `cmdk-blink`.
- **Three-column top bar.** `.tbar` is a grid (breadcrumb, centred search, actions) only when it
  holds a `.searchbox`; every other top bar keeps the 1.3 layout.

### Changed

- **Console top bars with a search now centre it.** Every `.tbar` that holds a `.searchbox`
  (including 1.3 consoles built on `ConsoleTopbar` with `ConsoleSearch`) takes the three-column
  layout; on phone the search fills the space the hidden breadcrumb leaves.

### Fixed

- **Counts and unread dots are neutral (law 3).** `.ibtn .num`, `.ibtn .dot`, `.notif .udot` and `.mhint .newdot`
  painted the accent, out of line with the law 3 budget since 1.4.0 (counts and info badges are neutral). They now
  draw on the text ladder: `--text-1`, with `--bg` ink on the count.

## 1.5.0 · 2026-11-01

### Added

- **Neutral checkbox `.chk`.** A native checkbox that fills with `--text-1` when checked, so selection inside content spends
  no accent (law 3 budget). Focus ring, disabled state.
- **Picker row `.pickrow` and `.pickgroup`.** Checkbox, a title over a mono key and a meta line, an optional trailing tag;
  centred, 44px minimum, the checked row on `--surface-2`.
- **Search block `.searchblock`.** A search field and its filter chips as one evenly spaced unit (16px padding, 12px gap),
  chips on one scrolling line.
- **Tag chip `.tchip`.** A read-only label with optional icon and count; `.on` marks the active one.

### Changed

- **Table cells centre vertically** (`.table th, .table td { vertical-align: middle }`).

## 1.4.0 · 2026-10-31

### Changed

- **Accent budget (law 3).** One primary action plus the active nav item or tab per view. `--accent-active-glow` is now
  `none` in both modes (law 3 already banned a colored outer glow; the bloom stays as the named device). Pressed filter
  chips (`.fchip[aria-pressed="true"]`) and hot nav counts (`.snav .cnt.hot`, and the collapsed-rail dot) are neutral.
  Products that COPY recipes (for example a vendored `.fchip` or console-shell CSS) re-copy these rules.

### Added

- **Two-line choice `.sel.two-line`.** A native radio or checkbox beside a label and a `.metaline`, 44px minimum height.
- **Table identity cell `.table .ident`.** Name (`b`, 600, `--text-1`, one line) over email (`small`, `--text-2`, wraps anywhere, never truncates).

## 1.3.1 · 2026-10-27

### Fixed

- **Console sidebar foot.** `.cside-ft` gets a `minmax(0,1fr)` column, so a long account email
  ellipsizes inside the capsule instead of pushing the capsule and the collapse row past the
  sidebar's glass edge (measured 268.9px against a 264px sidebar on the console block).
- **Console phone nav from 768px to 899px.** The sidebar hides below 900px but `.navshell` hid
  from 768px, leaving no nav in that band. A `.navshell` placed after `.cshell` now stays through
  899px; every other `.navshell` keeps the 768px rule.

## 1.3.0 · 2026-10-27

1.2.0 never reached npm. It ships inside 1.3.0: everything under 1.2.0 below is new on npm with this release.

Upgrading copied parts: `npx verseva add` keeps files you already have, so re-add `menu` first
(`npx verseva add menu --force`); the console shell parts need the 1.3.0 `Menu`.

### Added

- **Console shell.** The console frame as parts you adopt one at a time: a floating glass
  sidebar (`.cshell`, `.cside`, `.cside-nav`, `.cside-ft`) with an org switcher on top
  (`.switcher`: logo, wordmark or initials, your role, a checked org list and the org actions),
  grouped icon rows, a collapse row (`[` toggles) above the account capsule (`.capsule`:
  avatar, name, email, account menu, settings gear) and the platform stamp (`.platform`: mark
  and version). A top bar (`.tbar`) carries the breadcrumb, search with the ⌘K / Ctrl K chord,
  notifications (`.ibtn` with a count, `.notif` rows in a non-modal panel) and a guides menu.
  What's new opens as a right sheet (`.drawer` over `.scrim`): releases newest first, each
  change tagged New, Improved or Fixed (`.badge.bloom` is new), unread until opened. The
  sidebar collapses to a 72px icon rail (`.cside[data-collapsed]`) whose labels show on hover
  and on keyboard focus (`.railtip`); urgent counts become dots. Every part carries hover,
  focus-visible, press, disabled and reduced-motion states. Contract: "Console shell".
- **React parts** (`npx verseva add <name>`): `console-shell`, `org-switcher`,
  `account-capsule`, `console-topbar`, `whats-new`, and `console-state` (the pure rules:
  SemVer compare, the What's new unread rule, collapse persistence, shortcut guards). Storage
  keys: `verseva.whatsnew.seen`, `verseva.shell.collapsed`.
- **`templates/releases.json`**: the release-notes shape (`version`, `date`, `changes[]` of
  `kind` and `text`) with example data.
- **Specimens**: console shell, rail, org switcher, account capsule, top bar, notifications,
  What's new, and the loading, empty and error states of the panel and the drawer.
- **New global class names** in `components.css` (check your app for clashes before
  upgrading): `.cshell`, `.cside`, `.cside-nav`, `.cside-ft`, `.cmain`, `.cbody`, `.switcher`,
  `.otile`, `.oname`, `.oword`, `.capsule`, `.acct`, `.collapse-row`, `.ibtn`, `.platform`,
  `.pmark`, `.tbar`, `.tbar-end`, `.panel-hd`, `.notifs`, `.notif`, `.udot`, `.panel-empty`,
  `.panel-ft`, `.scrim`, `.drawer`, `.drawer-hd`, `.drawer-bd`, `.vchip`, `.railtip`, `.mhint`,
  `.newdot`, `.nl`, `.ni`, `.badge.bloom`. Release internals (`.rel`, `.relhead`, `.chgs`, `.chg`)
  apply inside `.drawer` only, and `.who` inside `.acct` only.
- `npm run typecheck`: the React parts under the studio's strict TypeScript (needs
  `studio/node_modules`).
- The `console` block and gallery example rebuilt on the shell, with a fictional org and
  platform.

### Changed

- `ConsoleNav` gains `collapsed` (rail rendering) and `icons`; labels render in `.nl`.
  `Menu` gains checkable items (`checked`), hints, disabled items, `renderTrigger`, `label`,
  `listClassName`, `align` and `onOpenChange`. Both stay backward compatible: 1.1.0 and 1.2.0
  copies compile and render unchanged.

### Deprecated

- `.orgchip`: use `.switcher`. Kept for existing copies, removed in 2.0.

### Fixed

- `.snav .cnt.hot` had no rule although the React nav emitted the class. It now renders as
  the accent bloom, and as a dot in the rail.

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

Seven console recipes, promoted from a production CRM, each with every contract state
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
  content. **Console navigation in two variants**: flat grouped rows (a production
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
