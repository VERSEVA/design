# Component contract

What every interactive component owes the user, regardless of brand. Themes style these; they may
not remove states or shrink the accessibility floor. Rendered as specimens in the studio (`design.verseva.com/components`);
shipped as CSS in `components.css`.

## Global floor (every component)

- **States are contract:** default / hover / active / focus-visible / disabled, plus loading and
  error where the component can load or fail. A component missing a state is unfinished.
- **Focus:** `:focus-visible` ring, 2px `--focus`, 2px offset, visible on both themes. Never
  `outline: none` without a replacement.
- **Touch targets:** ≥ 44×44px effective hit area on touch surfaces.
- **Contrast:** labels ≥ 4.5:1, large text and non-text meaningful parts ≥ 3:1.
- **Never color-alone:** state changes pair color with text, icon, or shape.
- **Motion:** `--dur-1`/`--dur-2` + `--ease-standard`, transform/opacity (+ color) only.
- **Keyboard:** every pointer interaction has a keyboard path; focus order follows visual order.
- **View first, edit on intent (ratified by Xhunn 2026-08-22):** a surface that shows a
  person their own data opens in a READING state, not an editing one. Fields render as
  values, and an explicit Edit turns the block into inputs with Save and Cancel. Reasons:
  a page of live text boxes reads as a form to be completed rather than a record to be
  read; it gives no signal about what is already saved; and it invites a stray keystroke
  into a field nobody meant to touch. Capture the intent to edit before offering the
  means. Applies to profile, settings, org and brand detail, and any single-record
  surface. It does NOT apply to controls whose whole purpose is immediate (search,
  filters, a theme switch), to genuine creation forms, or to a modal opened expressly to
  edit something, where the intent was captured by opening it.

## Consumption note (the tokens-only foot-gun)

`tokens.css` carries values only. A consumer that imports tokens without `components.css`
(including the Tailwind bridges, which import tokens alone) inherits NONE of the contract
states: no `:disabled` treatment, no loading affordance, no state recipes. Either import
`components.css`, or own the full state set in the app's own component layer, copied
verbatim from it so the two cannot drift. An app-declared `.btn` with no `:disabled` rule is
the recorded failure mode (a dozen live-looking dead buttons).

## Button: `.btn`

- Variants: `primary` (accent fill, `--accent-ink` label), `secondary` (`--surface` +
  `--hairline` border), `ghost`, `destructive` (confirm or undo downstream).
- Sizes sm 32 / md 40 / lg 48; label weight per `--btn-weight`; icon gap `--s-2`.
- States per the floor; loading = spinner replaces label, width locked, `aria-busy`.
- One primary per view. Label is a verb. **Hierarchy comes from FILL, not size:** a
  primary/secondary pair sits equal-sized. Themes may define a matte `--accent-fill` gradient;
  it holds label AA and carries no colored outer glow.
- **Dark-floor deviation required:** the secondary recipe's `--hairline` border does not clear
  the 3:1 boundary floor on a dark ground; the boundary comes from the text ladder or a fill.

## Input / field: `.field`

Label above (placeholder is never the label), 40/48px heights, `--r-sm`, error replaces help with
`aria-invalid` + `aria-describedby` wired. Inline validation on blur; error copy says how to fix.

## Selection controls: `.sel`, `.switch`

20px control, 44px hit area, `--accent` selected. Checkbox = many-of, radio = one-of (2–5),
switch = instant effect. Label inside hit area.

## Card: `.card`

`--surface` + 1px `--hairline` + radius per theme posture; `--e-1` at most resting. Whole-card
link: one overlay `<a>`, inner interactives reachable. Hover: hairline strengthens or `--e-2`.

## Top navigation: `.topnav`

56–64px; logo top-left links home; active link `--text-1` + marker; one CTA max. Sticky allowed
(`backdrop-blur` allowed on fixed chrome). Mobile: disclosure menu, focus trapped, Escape closes.

## Table: `.table`

Header `label` type + `--hairline` underline, rows ≥44px, hover `--surface-2`, numerics
right-aligned tabular-nums, pinned header on long tables (`.pin`, below), states trio applies.

## Pinned list header: `.pin` (long lists only)

A list that grows with its data (an index, a registry, an inbox, a log, an import) pins its
header row, so every column, dot and badge stays named while the reader scrolls. A list whose
length is fixed by design (a quote's cost lines, a spec sheet, a table inside a card, sheet or
modal, a band of the latest few) does NOT pin: a pinned header over five rows is chrome for
nothing. Pinning is decided per list when the list is built; a list that turns long later gains
`.pin` in the change that made it long.

- **Mechanism:** `.pin` on the list's wrapper. The header is `thead th` in a `.table`, or the row
  marked `.pin-head` in a non-table list (`.lrows`, grid lists).
- **Under the sticky chrome:** the header pins at `--sticky-top`, which the surface sets to its
  sticky bar's height (unset = 0). Header cells carry an opaque fill and draw the underline as
  an inset shadow: a translucent pinned row shows rows sliding under it, and a collapsed table
  border stays behind when the cell moves.
- **The overflow trap:** an ancestor with `overflow: hidden | auto | scroll` becomes the sticky
  container and the header silently stops pinning. `.pin` clips with `overflow: clip`, which
  keeps rounded corners without creating a scroller; nothing between `.pin` and the page may
  scroll.
- **Wide lists:** a list cannot pin to the page and scroll sideways at once. Below 1024px, and
  always with `.pin.box`, the wrapper becomes the scroll box in both axes, capped at the
  viewport under the chrome (`100dvh - --sticky-top - --sticky-bottom - --s-4`;
  `--sticky-bottom` is a floating bottom bar's height), and the header pins to the box's top.
  Use `.pin.box` for any list that can outgrow its column on a desktop.

## Badge: `.badge` · Toast: `.toast` · Modal: `.modal`

Badge: caption type, tinted fg/bg pairs, always with text. Toast: `--surface-2` + `--e-2`,
auto-dismiss 4–6s paused on hover, `role="status"`, errors persist. Modal: `--r-lg` + `--e-3`,
focus trapped, Escape closes non-destructive, focus returns to invoker, destructive action never
default-focused.

## The states trio (every data surface)

Empty says what belongs here + one creating action; loading = skeletons (`.skel`) mirroring real
layout; error says what failed + retry + preserved input. Never bare "No data" or a raw code.

## Segmented: `.seg` · Filter chips: `.fchip` · Search: `.searchbox`

Segmented: 2–5 options, one active, arrow keys + `role="tablist"`, active pill brightness is
MODE-SPECIFIC (navshell law). Chips: one scrollable row, selected = accent tint + weight 600,
dismiss × has its own ≥24px target; filters never repaint chart series colors. Search:
placeholder-as-hint is the one label exemption (`aria-label` required); shortcut chip in mono.

## List row: `.lrow` + `.metaline`

Row ≥44px: leading avatar/icon, primary line body/600, metaline 12px sentence-case `--text-3`
(never mono), right slot tabular-nums or chevron. Whole row tappable, inner actions reachable.

## Sheet: `.sheet`

Mobile bottom sheet, top corners 26–30, grabber, focus trapped, drag/Escape dismiss, content
scrolls inside fixed chrome. Desktop: side drawer 360–480px. Navigation never lives in a sheet.

## NAVSHELL: `.navshell` (the signature's most particular component)

**Copy it, never approximate it.** `components.css` carries the 1:1 port; the studio renders it
interactively.

- Frosted CONTAINER (blur `--glass-blur` + saturate `--glass-sat`, r30, glass border +
  shadow/glow/inset) FRAMING an inset main pill (r24, h62, `--surface-body` over `--nav-main`)
  with a consistent 6px `--nav-gap`. Tiers separate by SHADE, never a hairline.
- **nav-tier-brightness (MODE-SPECIFIC):** light = bright main pill on recessed grey frame;
  dark = INVERTED, lighter frame, darker recessed pill.
- Tabs ICON-ONLY; the ACTIVE tab opens its 9.5px/700 label inside the accent BLOOM
  (`--accent-on` ink, flex-grow 1.5, glow). Press = scale(.94). No hard pill, no ring.
- Sub-nav tier ONLY for tabs with real sub-sections (navigation-two-tier law; never invent one).
- 3–5 destinations, targets ≥44px, floats inset 14px sides / 18px bottom, never scrolls away.

## Console navigation: `.snav`, `.orgchip`, `.grouplabel`

Sidebar: org switcher top, grouped tree with `label` headers, ONE active item (accent-tinted pill
+ soft glow), counts as badges. Topbar: search + chips + icon actions; a header divides content.

## Stat tile: `.stat`

Big numeral (display family, tabular-nums) + quiet caption + optional signed delta chip (never
color-alone).

## Charts: `.chartcard`, `.bars`, `.heat` (the data contract)

- **Form follows the job:** magnitude = bars; change = line; share = ring ≤3 or stacked bar;
  one number = stat tile, not a chart; density = single-hue intensity cells.
- **Color by job:** sequential = the `--data-0..3` ladder, ONE hue; diverging = two hues +
  neutral midpoint; categorical = fixed order, max 5 then "Other"; status colors never become
  series colors.
- **Marks:** thin; bars gapped ≥2px, rounded at the data end only, ALWAYS from zero; lines 2px;
  grid recessive at `--hairline`; ONE axis.
- **Labels:** text tokens, never series color; selective direct labels; internals ≤10px mono.
- **Takeaway caption, mandatory:** label the MEANING, not the axis.
- **Hover:** per-mark tooltips; ≥2 series get a legend.

## Specimen rule

Every component appears in the studio in every contract state, per theme. A theme that styles a
component updates its studio specimen in the same change (sync rule).
