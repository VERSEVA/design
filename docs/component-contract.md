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

Header `label` type (12px/600 sentence-case sans in `--text-2`; never uppercase tracked mono,
law 4) + `--hairline` underline, rows ≥44px, hover `--surface-2`, numerics right-aligned
tabular-nums, pinned header on long tables (`.pin`, below), states trio applies. Selectable rows
and the bulk bar: see Bulk selection.

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
(never mono; `--text-2` inside `.glass`), right slot tabular-nums or chevron. Whole row tappable
(`a.lrow`, focus ring inset), inner actions reachable.

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

Sidebar: org switcher top, grouped tree with `label` headers (`.grouplabel`: 12px/600
sentence-case sans in `--text-2`, never uppercase tracked mono), ONE active item, counts as badges.
Topbar: search + chips + icon actions; a header divides content.

- **Active (the sidebar bloom):** `.active` or `aria-current="page"` puts the accent bloom behind
  the item, `.tab.on`'s `--accent-bloom` + `--accent-active-glow` verbatim (law 3 named device);
  label `--text-1`/600 for AA, icon `--accent-on`. Prefer `aria-current="page"` so the state is
  read, not only seen.
- **States:** hover `--surface-2` + `--text-1`; focus-visible 2px `--focus` ring at 2px offset;
  press sits down 1px (law 8); disabled `aria-disabled="true"` at .45, not focusable by pointer.
  Reduced motion drops the transitions and the press.

## Glass panel: `.glass`

Law 1 on a content panel: `.navshell`'s container material verbatim (`--glass-fill-3`,
`--glass-border`, `--glass-shadow` + `--glass-glow` + `--glass-inset`) under `--surface-body`,
at `--r-md`. NO blur: panels scroll, and blur is reserved for fixed chrome.

- **Parts:** `.hd` header row (title left, counts or actions right, hairline under), `.bd`
  padded body, or a `.table` / `.lrows` / `.kv` / `.tline` placed directly so rows run edge to
  edge. Inside, tables pad 16px at the sides with 52px rows and lose the last hairline.
- **States:** row hover is a 4% `--text-1` wash (not `--surface-2`, which reads as a hole in
  glass); loading = `.skel` rows; empty = `.empty`, borderless inside the panel.
- **Contrast:** the catch-light brightens the top rows (dark `--text-3` drops to about 4.0:1
  under it), so meta text inside (`.metaline`, `.lbl`, `.sub`, `.help`, `.kv dt`) lifts to
  `--text-2`. `.glass` also dresses a `.stat` or `.chartcard` on the same element.
- `overflow` stays visible so row menus escape the panel; the last row rounds its own corners.
- One material per surface region: panels are glass or `.card`, never mixed in one column.

## Row menu: `.menu.inline` + checkable `.menu-item`

A ghost `.btn.sm` trigger wraps the cell's own value (a status badge, an owner) so the value IS
the control. It pulls left by `--s-2` so the value keeps its column edge.

- **Checked item:** `role="menuitemradio"` (one of a set) or `menuitemcheckbox`, with
  `aria-checked`; the checked item carries weight 600 + a trailing `.tick` icon (state never by
  color alone). Status options render as the same badges the cell shows.
- **States:** trigger hover `--surface-2`, `aria-expanded="true"` holds the fill; item hover /
  focus-visible per `.menu-item`; disabled item `:disabled` or `aria-disabled` at .45; saving =
  `aria-busy="true"` + `.spinner` in the item. `.menu.end` right-aligns the list.
- **Keyboard:** Enter/Space opens, arrows move, Enter picks and closes, Escape closes and returns
  focus to the trigger. Picking applies at once (no Save); undo comes from the toast.

## Read-only field list: `.kv`

The reading state of view-first-edit-on-intent. A `<dl>`: each `<div>` holds `<dt>` (12px
`--text-3`) above `<dd>` (14px/600 `--text-1`, long values wrap anywhere). An empty value is a
quiet `.unset` word ("Not set"), never a blank row. Links underline on a hairline and fill on
hover. Loading: a `.skel` in the `dd`. Edit swaps the whole list for a `.field` form with Save
and Cancel; the list is never a disabled form.

## Timeline: `.tline`

A record's activity, newest first: `<ol class="lrows tline">` of `.lrow` items. The event type
is an icon inside the `.avc` slot (13px, quiet; no pill per row), the primary line says what
happened, the metaline says who · reference · `<time datetime>`. An optional right-slot badge
carries an outcome. A newly arrived item takes `.new` (one rise, reduced motion skips it). Empty
= `.empty` with the creating action; loading = skeleton rows.

## Confirm-to-erase: `.modal.erase`

For irreversible deletes of a named record (a contact, an org, a workspace). A
`role="alertdialog"` `.modal` whose body names exactly what goes (counts as data), then a field:
"Type `.phrase` to confirm". The phrase is the record's name as shown on the page.

- **Armed only on an exact match:** the erase `.btn-destructive` stays `disabled` until the
  input equals the phrase (trimmed, case-sensitive, paste allowed); armed, it fills solid
  `--danger` with `--bg` ink.
- **Focus:** Cancel takes default focus (destructive never default-focused); Escape cancels;
  Enter submits only while armed.
- **States:** erasing = the button gets `.spinner` + `aria-busy`, the input disables; failure =
  `.callout.err` in the body, the typed phrase kept.
- Use it for erasure only. Reversible deletes use undo, not a typed gate.

## Bulk selection: `.pick` + `.bulkbar`

- **Rows:** a leading `th.pick` / `td.pick` column of checkboxes, each inside a `<label>` that
  gives a 44px target, each with an `aria-label` naming its row. The header box selects all and
  shows `indeterminate` when some are picked. A picked row sets `aria-selected="true"` on its
  `tr` and takes an 8% accent wash.
- **Bar:** `.bulkbar` (`role="toolbar"`) appears while one or more rows are picked: count first
  (`.count`, live region, "3 selected"), then at most three actions, destructive last, then a
  clear (×) icon button. It is fixed chrome: sticky at the viewport bottom above any floating
  nav (`--sticky-bottom`), glass material WITH blur. It enters with one rise; reduced motion
  skips it.
- **States:** hidden at zero; disabled action when it cannot apply to every picked row; working
  = `aria-busy="true"` on the bar + `.spinner` in the acting button; result reported in a toast,
  selection cleared on success, kept on failure. Escape clears the selection.

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
