# Changelog

## 1.8.0 · 2026-11-27

The proof release. A surface can now be checked for the signature, not only for legal values: the recipe gate reports hand-built contract parts and missing material, `verseva doctor` shows version lag and local overrides, and `verseva board` shows any theme on every specimen with its ratios and bans. New parts: the bounded section, the step funnel, the date range control and the write-only secret field. New templates: a deck and a document. Charts gain withheld values, gaps, a hidden data table, and an opt-in cap. No class or token is renamed or removed. Read Changed before upgrading: chart markup, bar heights, filter chip height and the `--exclude` rule all move.

### Added

- **Deck template: `templates/deck.html`, `npx verseva add deck` (PR 228).** One self-contained HTML deck on the signature: eight sample slides, each face a title that states the claim and one support line, every number labelled Fact, Estimate or Projection, sources behind a Sources control. Arrow keys, Page Up and Down, Space, Home, End and a swipe move one slide at a time and keep `#n` in the URL. With scripting off the slides read as one scroll; print gives one slide per page at 1280 by 720. Registered under `blocks` with `kind: "template"`. `verseva add` falls back to blocks for template names and inlines `tokens.css` and `components.css`, so the file opens from `file://`. The template links no font host.
- **Document template: `templates/document.html`, `npx verseva add document` (PR 234).** A claim title, a meta line, four sections, labelled stats, a chart and a 36-row table. Print is A4 on white paper with a running header on every page, the table on its own page and its header row repeated on every page it spans. Everything reads with scripting off. Boots light; delete `data-theme` for dark. Its classes are template-local (`doc-` prefix); nothing is added to `components.css`.
- **`verseva board --manifest <file>` (PRs 225, 232).** Serves every contract specimen on 127.0.0.1 under the themes a local manifest names, with a brand switcher, so a theme author sees a theme on the whole system without publishing it. The board shows the live contrast ratio of every pair the contrast gate checks, for the brand and mode on screen, and a check that each ban the manifest declares (`bans: ["glass"]`, `["bloom"]`) renders on every matching specimen. The manifest and every theme must be regular `.css` files inside the working directory: paths that leave it, symlinks and FIFOs are refused, and a bad manifest or an unknown ban stops with one line and exit 2. The server answers only a loopback Host, refuses cross-site requests, serves only package files and themes by manifest id, and hashes its inline scripts from the shipped page. `templates/theme-manifest.example.json` names the four presets. The package now ships `site/components.html`, `site/site.css` and `site/theme.js` for it.
- **`verseva doctor` (PR 221).** Reports how far a product's installed `@verseva/design` lags the latest release, and every rule in its own CSS that targets a package class, as file, line and selector. `--json` prints a stable object (schema 1); `--strict` exits 1 when any override exists; errors exit 2. It reads only inside the working directory (no symlinks, no `node_modules`, no dot directories, not the `verseva.json` `dir`). Its only network call is one HTTPS GET to the public npm registry; offline it reports `latest unknown` and still lists overrides. CSS files over 1 MB are skipped and named.
- **Agent briefs: `verseva brief <name>` and the MCP tool `get_brief` (PR 224).** One call returns a component's source, the laws that bind it in full, its contract section with its bans, and the line that the gate suite must pass. Every `kind: component` entry in `registry.json` gains `laws` and `contract`; utilities, blocks and themes carry neither. Input is a registry name only; anything else fails in one line with a non-zero exit.
- **`verseva-recipe-gate` (PRs 201, 222, 226).** A fifth gate reports where a surface rebuilds a contract part by hand (a `button`, `table`, `input`, `textarea`, `select` or `dialog` with no contract class on it or its parent part), and where a project consumes none of the signature material (`--glass-*`, `--nav-*`, `--accent-bloom` and the classes that carry them). `--strict` exits 1 on findings. Waive one element with `recipe-ok: <reason>`; skip paths with `recipeAllow` and the material check with `"material": "none"` in `verseva.json`. How it runs in the suite is under Advisory.
- **Bounded section: `.bounded` (PRs 203, 218).** A section never grows with its data. `.bounded` on a section and `.bounded-rows` on its rows cap the rows on screen at 5, or at `data-cap="1"` to `"12"`; any other value falls back to 5. The foot holds a quiet "+N more" line and a Show all action named with its section. New contract section, the `BoundedSection` React part (`verseva add bounded-section`), and its limits in the pure module `bounded-state` (`BOUNDED_CAP`, `boundedCap`, `BOUNDED_MAX_CAP`).
- **Step funnel: `.funnel` (PR 231).** How many reach each step, the drop between steps, and the biggest drop flagged. `Funnel` takes the bar item shape (so a step can be suppressed), an optional share of the first step, a loading state, and a hidden data table on by default. It uses no hook, so it renders without a client boundary. Its words are `FUNNEL_LABELS` in `react/labels.ts`. New contract section and `npx verseva add funnel`.
- **Date range control: `.range-ctl`, `.range-fields` (PR 220).** One control sets the period a page of charts covers: the host's presets as a radiogroup on `.seg`, an optional Compare chip, a range line and two date fields for Custom; a compact form puts the presets behind one `.menu` trigger. Under 560px the custom dates open in the `.sheet`. The value is one plain object (`range`, `from`, `to`, `compare`); the part is controlled and never touches the URL. `.seg` gains `[aria-checked]` styling, and `.sheet` and `.modal` can sit on a native `<dialog>`. React: `DateRange` with the pure `date-range-state` module (`npx verseva add date-range`).
- **Secret field: a write-only field for keys and tokens (PR 219).** `SecretField` (`npx verseva add secret-field`) is empty after a save, shows the Set badge, and replaces in place with Save and Cancel. The stored value never comes back in, and the typed value is held by the input alone, cleared when the save lands. A failed save keeps the value for a retry and announces the error. Its words are `SECRET_FIELD_LABELS` in `react/labels.ts`. It adds no CSS. Its save contract is under Privacy.
- **Charts: withheld values and gaps (PR 212).** `Bars` and `HBars` items take `display` and `suppressed`. A suppressed item draws a fixed hatched stub with no fill, prints `display`, and keeps its value out of the scale, the `title` and every attribute. `LineChart` series and `Sparkline` values take `null` (or `NaN`) for a gap: the line breaks, a hatched band below the baseline marks it, and it is never drawn as zero or interpolated. The withheld word is copy (`vizLabels`, default in `react/labels.ts`). `Bars` and `HBars` use no hook.
- **Charts: an opt-in cap (PR 235).** `Bars`, `HBars` and `LineChart` take `cap`. Bars keep the first `cap` items by position and fold the rest into one Other mark on the alt fill. A line chart keeps the newest `cap` points and shows a "Last N" note in its legend and table caption. Without `cap`, nothing changes. The fold's privacy rules are under Privacy.
- **Container mode for the widget grid (PR 213).** Wrap `.wgrid` in `.wgrid-wrap`, or pass `container` to `WidgetGrid`, and the grid counts columns from its wrapper: 4 from 688px, 2 from 560px, 1 below. `CONTAINER_BREAKPOINTS` and `columnsForContainer` carry the numbers.
- **`'use client';` on every stateful React file (PR 208).** A server-component framework can import the parts. Pure files carry no directive and stay importable from server code. `verseva add` copies the directive with the file, and a test fails when a new stateful file misses it.
- **`--exclude <dir>` on the gate suite (PRs 183, 230).** `verseva-gate` and the hex, spacing, type and recipe gates take a repeatable `--exclude <dir>`. Nothing is excluded unless the flag is passed. The depth rule changed in this release; see Changed.
- **Token resolver: `npm run tokens:resolve` (PR 184).** `bin/resolve-tokens.mjs` resolves the cascade, `var()` and `color-mix()` in the token files to plain values, and fails loudly on malformed CSS.

### Changed

- **Every chart now carries a visually hidden data table (PR 229).** `Bars`, `HBars`, `LineChart` and `Sparkline` render their values in an `.sr-only` table (a `Sparkline` uses table roles on spans, valid inside a paragraph), and the visible chart becomes `aria-hidden`. Keyboard and touch users now reach the values. Consumer snapshot tests will change; pass `table={false}` to keep the old markup. Name a chart with `label`.
- **Bar fill heights follow the plot area (PR 233).** A `Bars` fill was a share of the whole column, labels included, and tall fills were squeezed to one height. Fills are now proportional to the plot, so bars that rendered at equal heights for different values now differ.
- **`--exclude <name>` applies at every depth (PR 230).** It used to skip only a top-level directory of that name. A nested directory of that name is now skipped too, so you may scan less than before. Symlinked files and directories met during a scan are skipped, and a file whose real path leaves the scan root is not read.
- **Filter chips use the body font (PR 220).** `.fchip` now sets `font-family: inherit` instead of falling back to the browser's default face. Chips that were falling back grow about 3px taller.
- **Default labels moved into pure modules (PRs 208, 218).** A server component that imported a constant from a `'use client'` file got a client reference, so spreading default labels silently yielded nothing. The label constants now live in `react/command-state`, `react/console-state`, `react/widget-state` and the new `react/labels`, and `BOUNDED_CAP` and `boundedCap` in `react/bounded-state`. The old exports from client files still work in client code and are marked `@deprecated`; on a server they arrive as client references and lose their values, so import from the pure module there. Values are unchanged. Re-adding `smart-stack` or `viz` with `verseva add` now also copies `labels`.
- **`WidgetGrid` gains an opt-in `container` prop (PR 213).** Default rendering is unchanged.
- **Node 22 or later (PR 64).** `package.json` declares `engines.node >=22`, matching CI.
- **The CLI's subcommands live in `bin/cmd-<name>.mjs` (PR 202).** `verseva` discovers them, and stops with one line on a clashing, reserved or malformed command module. Commands and flags are unchanged.
- **CLI and MCP refuse symlinks and bad config (PRs 43, 44, 221).** MCP `add_component` refuses symlinked destinations, as the CLI does. A malformed `verseva.json`, `.mcp.json` or `package.json` fails with one line, which no longer quotes the parser message. A symlinked `verseva.json` is refused before it is read.
- **A missing path or token file makes a gate exit 2 (errored), never 1 (violation) (PR 45).**
- **`verseva list` aligns its description column (PR 120).** Names longer than 12 characters no longer break it.
- **React accessibility fixes (PRs 95, 108, 109).** Each tab has an id so its panel is labelled by it; an accordion's summary mirrors its open state in `aria-expanded`; `CardHeader` renders an interpolated text title as its `h4` heading.
- **Charts hold on edge data (PR 121).** An empty `Sparkline` or `LineChart` renders without throwing, hover skips a short series, and `Ring` clamps to 0 to 100.
- **The studio side nav sits flush against the window's left edge (PR 77).** Only the content column is capped (1208px) and centred.

### Experimental

- **`./react/*` exports (PR 208).** `@verseva/design/react/viz` resolves to `react/viz.tsx`, and the logic modules resolve to their `.ts` files. It is raw TypeScript source: your bundler transpiles it. Prop shapes may change in a minor release until the export is declared stable. No React peer is declared, and `verseva add` is unchanged.

### Advisory

- **The recipe gate runs inside `verseva-gate` as advisory (PRs 201, 222, 223, 226).** `verseva-gate` runs it after the four gates and prints its findings under an `advisory:` heading. It never changes the exit code, even when it errors or hangs: it is stopped after 60 seconds. The four gates' output and exit codes are unchanged, and the summary still counts four. `--no-advisory` skips it. Law 13 gains a dated amendment (2026-11-27); promotion to an enforcing gate is a later ruling.

### Privacy

- **The chart fold never leaks a withheld value (PR 235, opt-in).** A suppressed item never adds to Other. Other is itself suppressed, shown as "<5", when it holds a suppressed item, when its total is under 5, or when its total is not a finite number.
- **In charts, `display` alone is not a privacy floor (PR 212).** `display` only replaces the printed value; the bar still draws to scale. A withheld value needs `suppressed: true`.
- **The secret field's `onSave(value, signal)` gets an `AbortSignal` (PR 219).** Cancel, Escape and unmount abort it. A host that ignores the signal may still store a value after Cancel.

## 1.7.0 · 2026-11-05

The one-site release. Every chapter and gallery example is a native, pre-rendered studio page in one tile language, with its own head; old links land in the studio. The studio has a new shell (search, one-button mode, custom color, icon rail, sticky side nav, On this page) and a new home (live product hero, ambient Get started). Package changes: `.badge.bloom` is neutral; the React parts run on React 18 and 19 (`react/inert.ts`); `LiveActivity` gains optional `emptyAction` and `onOpenChange`; `verseva add` warns below React 18; the console and landing blocks hold at phone width. No class or token is renamed.

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
- **Studio command bar.** The top bar search (⌘K / Ctrl K) opens the package command bar over every route and
  every chapter and page section, built from the routes table and the section ids. A result navigates in the shell
  and lands focus on its section. Below 900px the search is an icon button and the bar is a full-height sheet.
- **Custom accent.** The color dot opens a popover with the five presets and Custom: a hue control and a hex field.
  Any pick is derived to `--accent`, `--accent-hover`, `--accent-ink` and `--focus` for dark and light, gated live
  (ink on accent and hover at 4.5:1, the accent and its hover on bg at 3:1, the accent on both surfaces at 3:1, text on the
  accent tint at 4.5:1; hover steps away from the page, as the presets do), and
  moved in OKLCH lightness to the nearest passing value when it fails, with the adjusted value and a pass or fail per
  check shown. The hue control changes only the hue of the original pick, so stepping back returns it. The popover
  traps focus while open. A chunk that fails to load shows a Retry in place. The choice persists and applies before first paint. Copy theme copies a ready
  `[data-brand="custom"]` theme file in the presets' shape (contrast-gate clean).
- **Icon rail.** The sidebar collapses to a 72px rail: one icon per Studio page and one per group, a tooltip on each,
  and a keyboard-operable flyout per group (arrows, Home, End, Enter, Esc back to the icon). The rail state persists
  and applies before first paint.
- **On this page.** Chapter and Foundations pages carry a right rail of their sections from 1200px, with scroll-spy
  (`aria-current="location"`) and focus moved on click.

### Changed

- **Top bar.** The studio header is the package three-column `.tbar`: lockup and version, the search trigger,
  then color, mode, pause motion and GitHub. Mode is one icon button that cycles light, dark and system, named
  "Theme: current. Switch to next", announced politely, and drawn from the head script's `data-mode` so it never
  shows a wrong icon. The five brand chips and the Light / Dark / System segmented control left the top bar (the
  Overview hero keeps its theme picker). The npm link left the bar.
- **Sidebar.** Studio, Chapters and Gallery are collapsible groups (open state persists; the group holding the
  active item stays open), Gallery lists its examples, counts stay neutral badges, and the active item carries the
  nav bloom. Per-chapter section anchors left the sidebar for the On this page rail and the command bar.
- **Phone shell from 900px.** The page and section select and the stacked header now apply below 900px (was 760px).
- **Lazy chunks.** The command bar (studio and /widgets), the color panel and the search commands load on first
  intent; their triggers stay in the main chunk, which measures 147.1 kB gzip under the unchanged 150 kB budget.
- **Studio home (`/`) is a live product hero.** "One source. Every surface" with one primary action, **Get started**
  (copies `npm i @verseva/design`, shows Copied, then lands on `/components#install`), and a quieter **Browse**
  (`/components`). Beside it, a real widget home on the package parts (`.wgrid` tiles): the smart stack rotates with
  its visible pause, a demo job ticks in the live activity capsule, and the focus widget's chart settles. Only the
  focus widget carries the accent. At phone widths the home drops to two tiles and the CTA stays above the fold.
- **Ambient motion on the home.** Get started carries a slow catch-light sweep inside its matte body (transform only,
  no glow, no outer shadow), held on hover and focus. A neutral drift (text-ladder and surface tones, no accent)
  moves behind the hero. Both start after mount and stop under Pause motion and under reduced motion.
- **Entry tiles** into Components, Widgets, Foundations and Gallery, labels and counts only, in the `/widgets` tile
  language, routed in the shell. The theme picker, token readout, frame stage and counts row leave the home (the
  header's color popover and Foundations carry them); the home no longer loads the 3D stage.
- **Studio specimen tiles.** Components and Foundations take the /widgets tile language: the package `.wgrid`
  bento and `.wtile` glass at `--r-lg`, with a header (category icon, name, neutral meta count), the live specimen
  in the body, and Show code with Copy in the footer. Tiles size to their content (S, M, L, XL; rows hug the
  specimen), XL drops to the M span under 1100px and every tile to one column under 560px. The tile carries the
  loading, empty and error states, and is one component (`studio/src/tiles/SpecimenTile.tsx`) for the chapters
  and the gallery to follow.
- **Components: 50 sections as tiles.** Section ids, deep links, the On this page rail and the demos are
  unchanged; each code panel shows the generated, byte-checked sample from `chapter-code.mjs`.
- **Foundations: each token family is a tile,** with its declarations (`:root` and the light flip) as its code.
- **Gallery: a bento of example tiles.** `/gallery` shows the 8 mock sites as XL, M and S tiles: the name and its
  tags as neutral badges in the header, a live thumbnail in the body, Live (`/gallery/<slug>`) and Code
  (`/gallery/<slug>/code`) in the footer. The tag filter chips stay, as neutral selection, with a count on each.
  Thumbnails are the example files scaled from 1280px: inert, `aria-hidden`, no pointer events, themed and branded
  with the studio. They load lazily (IntersectionObserver), at most 6 at once, 3 on phones, and sit still (CSS
  animations at their end state, the example's animation-frame loop held) until their tile is hovered or holds
  focus; never under Pause motion or reduced motion. Details and inspiration shots are tiles too.
- **Gallery example and code routes in the tile language.** `/gallery/<slug>` puts its frame in a tile (the file
  and tags in the header, Code in the footer) and `/gallery/<slug>/code` its source (Open live and Copy in the
  footer, Retry in the body on a failed chunk). Height fitting, theme and brand following, one scrollbar, the
  pre-rendered source, the breadcrumb JSON-LD and the 404s for unknown slugs are unchanged.
- **Retired: gallery parity.** `/gallery` and the code route no longer match `site/examples.html` and
  `site/code.html` element for element; both are logged in `studio/test/redesigned.ts` and held by
  `gallery-tiles.test.tsx` and the served `gallery.test.mjs` instead.
- **Web UI, Distribute and Docs + PDF as tiles.** Web UI: the ladders, type trio and radius tables, then the four
  contract specimens (Buttons, Status, Card + stat, Segmented + field) under their section. Distribute: the command
  blocks, the agent tool table and the theme presets. Docs + PDF: the memo in one XL tile. Section ids, cold deep links
  and the On this page rail are unchanged; the bento has no holes at 4 and 2 columns. The legacy doctrine sublabels
  above the Web UI specimens are gone (labels and counts only). These pages have no generated code samples, so their
  tiles show no code.
- **Data viz, Motion and Decks as tiles.** Data viz keeps law 3 the way a product must: one focus tile (Line + area)
  spends the data accent and the other nine charts draw on the text ladder. Motion's Replay, Roll it, Point at it,
  Resolve it and Open it sit in their tiles' footers; the theme wipe, the curves race and the Pause motion control
  work as before. Decks: the slide and the structure table side by side. The Data viz and Motion samples load on
  first intent (main chunk 141.22 to 137.56 kB gzip).
- **Data viz recipes follow the data-intensity rule.** Bar magnitude goes through `data-l` (new `.bar .fill[data-l]`
  rungs in `components.css`, with their text-ladder twins in a tile without `data-focus`), Stacked segments take
  series identity (series one, `--data-alt`, a neutral third on `--text-2`) instead of the magnitude ladder, the intensity legend
  uses the same rungs as its cells, and the source dot uses a neutral token, not `--success`. No chart colour is
  inline. The Data viz samples are generated from these specimens as drawn and held byte for byte
  (`specimen-code.test.tsx`), so a sample cannot drift from what renders.
- **Chart marks clear 3:1 and their labels 4.5:1 in both modes.** The text-ladder rung 1 a tile without `data-focus`
  draws (bars, heat cells, activity strips) lifts from 30% to 50% `--text-1` (light was 2.0:1, dark 2.6:1); the
  Stacked third series fills `--text-2` with a `--bg` label, and the Priced label takes `--surface` (4.46 to 5:1).
- **`SpecimenTile` `focus` prop** (default true): false drops `data-focus`, so the package recolours the tile's charts.

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
  type-checks against `@types/react` 18 and 19 in CI. React 18 or later is needed for the React parts
  only; the CSS, tokens and preset need no React, and the package declares no React peer, so it installs
  into any project. `verseva add` warns in one line when it copies React parts into a project on an
  older React.
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
- **On this page marks the deep-linked section on a page too short to scroll** (Decks at 1440x900: both tiles in
  one row below the line marked Slide anatomy for `/decks#structure`).
- **Gallery: the filter shows its result.** A filtered-out tile is no longer rendered (its `display:none` lost to the
  package `.wtile` display in the built CSS, so all 8 stayed on screen). Each filter's subset is sized to fill every
  row at 4 and 2 columns (its own sizes when they fit, else an XL first on an odd count and Ms in pairs), and the
  result is announced politely ("2 examples").
- **Gallery: a thumbnail that does not load shows the tile error with Retry.** A missing example answers with the
  studio shell (404.html); the tile no longer nests a studio in its thumbnail.
- **Gallery: the details bento has no holes** (Count-up stat and Skeleton to loaded take M), and the gallery joins the
  chapter copy guard (no em dash, no doctrine sublabels, every legacy text accounted for).
- **3D hero example: the copy holds its contrast over the scene.** The scene read its colours once at load, so a
  frame the studio flips to light after load kept a dark knot behind dark copy (about 1:1). It now re-reads the tokens
  on every theme or brand change and when a theme sheet lands, with light-mode lighting from the surface tones. A
  directional scrim in the ground colour sits between the scene and the copy (left to right on desktop, a band on
  phones), and the hint sits on a pill. A served probe samples the scene behind every line of copy over several
  frames, in both themes at 1440 and 375: headline and body at least 4.5:1, kicker and hint at least 3:1.
- **The studio side nav stays fixed while the page scrolls.** Expanded and collapsed to the rail, it sits below the
  header at full height, scrolls its own list when that is longer than the viewport, and keeps the collapse toggle
  in view at its foot (the expanded toggle had scrolled out of reach on long pages).
- **Home: the demo job is quiet.** It ticks visually but says nothing in its live region until the visitor opens the
  capsule panel.
- **Home: Copied is honest.** Get started says Copied only once `writeText` resolves. When the clipboard is denied or
  missing, or `writeText` throws, it says "Command below" and still lands on `/components#install` with focus there.
- **Home: the demo restarts.** Restart sits in the capsule panel whenever no job runs (done, rested or cancelled),
  and Cancel now stops the job. With the panel shut after a Cancel, a Restart shows in the tile instead.
- **`LiveActivity` takes `emptyAction` and `onOpenChange`.** `emptyAction` renders in the panel's empty state (a
  Restart, a Start); `onOpenChange` reports the panel opening and closing.
- Dropped the unused `.picker-lg` rules from `studio.css`.

### Tests

- `test/served/sidebar.test.mjs`: at 1280, `/components` scrolled to its end, the sidebar's top stays at the header
  bottom, it fills to the viewport bottom, and its collapse toggle is in view, expanded and collapsed.
- `test/served/home.test.mjs`: the law 3 accent budget on `/` at 1440 and 375 in both schemes (with a planted
  spend), the hero's animations (running, transform and opacity only, stopped by Pause motion and by reduced
  motion), Get started in Chrome (copied and denied, focus on `#install`), the budget with the job panel open, and the 375px fold at 667, 812 and 360 by 640. The served harness takes
  `reducedMotion`.
- The Components port's element-for-element parity with `site/components.html` (markup, `<style>` and the
  FROZEN pin) is retired, as the redesign changes its presentation on purpose (`studio/test/redesigned.ts`). The
  tile contract test (`specimen-tile.test.tsx`) replaces it; the specimen-to-sample and chapter script tests stay.
  Other chapters keep their parity tests.
- The class-name rule now covers the studio tile CSS.

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
