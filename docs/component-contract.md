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

## Console navigation: `.snav`, `.grouplabel`, `.switcher` (`.orgchip` deprecated)

Sidebar: org switcher top (`.switcher`, see Console shell), grouped tree with `label` headers
(`.grouplabel`: 12px/600 sentence-case sans in `--text-2`, never uppercase tracked mono), ONE
active item, counts as badges. Topbar: breadcrumb, search, notifications and guides (`.tbar`, see
Console shell); a header divides content.

- **Rows:** an optional icon, the label in `.nl` (one line, ellipsis), then a count. `.cnt` is a
  plain count; `.cnt.hot` is an urgent one: the accent bloom on an opaque `--surface-2` base with
  a `--text-1`/600 numeral (the base holds it at 4.5:1 on every theme over glass). In the rail a
  row with no icon shows its first letter in `.ni`; urgent counts become dots and plain counts
  hide, their numbers still in the link's name.
- **Active (the sidebar bloom):** `.active` or `aria-current="page"` puts the accent bloom behind
  the item, `.tab.on`'s `--accent-bloom` + `--accent-active-glow` verbatim (law 3 named device);
  label `--text-1`/600 for AA, icon `--accent-on`. Prefer `aria-current="page"` so the state is
  read, not only seen.
- **States:** hover `--surface-2` + `--text-1` (inside the glass sidebar the hover is a 6%
  `--text-1` wash instead, since `--surface-2` on glass reads as a hole); focus-visible 2px
  `--focus` ring at 2px offset; press sits down 1px (law 8); disabled `aria-disabled="true"` at
  .45, not focusable by pointer. Reduced motion drops the transitions and the press.
- **Deprecated:** `.orgchip`, the static org block, is deprecated in 1.3.0 for `.switcher` and is
  removed in 2.0. It stays in `components.css` until then so existing copies keep rendering.

## Console shell: `.cshell`, `.cside`, `.switcher`, `.capsule`, `.tbar`, `.drawer`

The desktop console frame (1.3.0): a floating glass sidebar beside a main column with a top bar.
Composable parts; the React copies (`npx verseva add console-shell ...`) render exactly this DOM.
Under 900px the sidebar hides and `.navshell` stays the phone nav.

**Anatomy**

| Region | Classes | Holds |
|---|---|---|
| Shell | `.cshell` (grid), `.skip`, `.cmain`, `main.cbody#main` | Skip link first in the DOM, the sidebar, the main column, one `.railtip` |
| Sidebar | `.cside` | Glass at `--r-lg`, inset `--s-3`, sticky under `--sticky-top`, 252px; head, `.cside-nav`, `.cside-ft`. Only `.cside-nav` scrolls, so head and foot stay put on short screens |
| Head | `.switcher` (`.word` for a wordmark), `.otile` (`.init` for initials), `.oword`, `.oname` + `small` | Org logo or initials, org name, your role, chevron; menu `.menu-list.full`: orgs as `menuitemradio` with role hints and a tick, then Organization settings, Members and roles, Billing, Invite people, New organization |
| Nav | `.cside-nav` > `.sgroup` > `.snav` | Grouped rows, see Console navigation |
| Foot | `.collapse-row`, `.capsule` (`.acct` + `.ibtn`), `.platform` (`.pmark`, `.v`) | Collapse row (`[`), account capsule (avatar, name, email; menu `.menu-list.up.full`: Profile, Appearance, Sign out) with the settings gear, platform mark + version (opens What's new) |
| Top bar | `.tbar`, `.crumbs`, `.searchbox`, `.tbar-end`, `.ibtn` + `.num` / `.dot` | Breadcrumb, search with the K chord, notifications bell with a count, guides button with an unread dot; menu: What's new (`.mhint` with `.ver` + `.newdot`), Guides, Keyboard shortcuts, Documentation, Contact support |
| Notifications | `.menu-list.panel`, `.panel-hd`, `ul.notifs` > `.notif`, `.panel-empty`, `.panel-ft` | A non-modal dialog under the bell: title + Mark all read, rows (`.unread` + `.udot`), View all |
| What's new | `.scrim` + `.drawer`, `.drawer-hd` (`h4`, `.vchip`, close `.ibtn`), `.drawer-bd` > `section.rel` (`.rel.seen`), `.relhead` (`h5`, `time`), `ul.chgs` > `.chg` | Right sheet, 400px: releases newest first, each change tagged New (`.badge.bloom`), Improved (`.badge.neutral`) or Fixed (`.badge.ok`) |
| Rail | `.cside[data-collapsed]`, `.railtip` | 72px icon rail: org tile, row icons, collapse icon, avatar, gear, mark; labels in one fixed `.railtip` |

**Material and contrast**

- `.cside` restates `.glass`'s material (`--surface-body` over `--glass-fill-3`, `--glass-border`,
  `--glass-shadow` + `--glass-glow` + `--glass-inset`) at `--r-lg`; it does not compose `.glass`,
  whose descendant recolors and `--r-md` radius would fight the nav. No blur, and no `transform`,
  `filter` or `backdrop-filter` on `.cside` or any ancestor of the rail tip: each would become the
  containing block of the fixed `.railtip` and clip it.
- **No `--text-3` directly on glass.** The catch-light drops dark `--text-3` to about 4.1:1.
  `--text-3` sits only on opaque fills (the switcher role, the account email, kbd chips, the
  notifications panel, the drawer); bare-glass text is `--text-2` at least (rows, group labels,
  collapse row, version).
- **Lifts:** the org role and the account email lift to `--text-2` on the hover and open wash (6%
  `--text-1` over `--surface-2`, where `--text-3` falls below 4:1); unread notification meta lifts
  to `--text-2` on the 5% accent wash; the urgent count's bloom sits on an opaque `--surface-2`.
- **Measured (1.3.0, Chrome, computed styles, composited at the glyph box; lowest across the base
  and the four presets):**

| Text | Dark | Light |
|---|---|---|
| Nav row, group label | 6.66 | 5.76 |
| Active row (bloom) | 5.08 | 11.58 |
| Count / urgent count | 6.98 / 4.61 | 5.24 / 10.23 |
| Org name / role / role (menu open) | 16.25 / 4.52 / 6.01 | 16.90 / 4.51 / 4.63 |
| Collapse label / kbd | 7.54 / 4.52 | 5.72 / 4.51 |
| Account name / email / email (menu open) | 16.25 / 4.52 / 6.01 | 16.90 / 4.51 / 4.63 |
| Platform version | 7.55 | 5.72 |
| Breadcrumb link / current | 7.66 / 17.84 | 5.37 / 17.35 |
| Notification meta, unread / read | 6.80 / 4.74 | 5.40 / 5.05 |
| Release date / seen change / New badge | 4.74 / 7.32 / 4.76 | 5.05 / 5.86 / 11.24 |

**Sizes and stacking:** sidebar 252, rail 72, top bar 60, icon button 32 (44 on a coarse pointer,
where nav rows, the collapse row, the account button and the platform stamp also reach 44),
notifications panel 340, drawer 400, search 360. `.tbar` 12, `.cside` 13 (sticky makes a
stacking context, so the sidebar sits above the bar), menus and `.railtip` 15, `.scrim` 16,
`.drawer` 17, the focused skip link 18.

**States**

| Part | Hover | Focus-visible | Press | Disabled | Other |
|---|---|---|---|---|---|
| Switcher, account | 6% `--text-1` wash on `--surface-2`; `aria-expanded="true"` holds it | 2px `--focus` at 2px | sits down 1px | switcher `:disabled` at .45 | role and email lift to `--text-2` while washed |
| Nav row | 6% `--text-1` wash on glass; the active row keeps its bloom | 2px ring | sits down 1px | `aria-disabled="true"` at .45 | active bloom; urgent count `.cnt.hot` |
| Collapse row | wash + `--text-1` | 2px ring | sits down 1px | none | in the rail the icon flips, instantly |
| Icon button | `--surface-2` + `--text-1` (in the capsule: wash on `--surface-2`) | 2px ring | scale .94 | `:disabled` or `aria-disabled` at .45 | `.num` count (99+ cap, `aria-hidden`; the label carries it), `.dot` unread |
| Platform stamp | `--text-1` | 2px ring | sits down 1px | none | opens What's new |
| Notification row | `--surface-2` (rows that act are buttons or links) | inset ring | none | none | unread: 5% accent wash + dot + visually hidden "Unread"; loading: three `.skel` rows; empty: `.panel-empty` "No notifications"; error: the app's message in `.panel-empty` with an optional Try again |
| Mark all read | `--text-1` | 2px ring | none | disabled at 0 unread | |
| What's new | close as icon button | close takes focus | | | releases newer than the last one seen render bright, older ones `.rel.seen` (neutral badges, `--text-2` text); loading: `.skel` rows; empty: `.empty` "No release notes"; error: the app's message in `.empty` with an optional Try again |
| Rail | as expanded | as expanded | as expanded | as expanded | collapse is a snap (252 to 72, no width animation); names visually hidden, never `display:none` |

Reduced motion drops every transition, every press transform, the scrim fade and the sheet slide.

**Accessibility**

| Part | Roles and names | Keyboard and focus | Rail |
|---|---|---|---|
| Shell | `.cside` `role="region"` + `aria-label="Sidebar"`; `main#main` `tabindex="-1"`; skip link first | Order: skip link, switcher, nav rows, collapse row, account, settings, platform, breadcrumb, search, bell, guides, page | Every name kept |
| Collapse row | `aria-label` "Collapse sidebar" / "Expand sidebar"; `aria-controls` the sidebar; `aria-keyshortcuts="["`; kbd `aria-hidden` | Enter, Space or `[` toggles; focus stays on the row | Tip "Expand sidebar"; icon flips instantly |
| Nav rows | `nav aria-label={group}` per group; active `aria-current="page"`; name = label + count | Tab through links; accordion heads (expanded only) keep `aria-expanded` / `aria-controls` | Label and plain counts visually hidden; urgent count a dot, its number still in the name; tip shows label and count on hover and on focus |
| Org switcher | Trigger `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`; list `role="menu"` `aria-label="Organizations"`; orgs `menuitemradio` + `aria-checked`; actions `menuitem` | Enter, Space or ArrowDown opens on the checked org; arrows, Home, End move; Enter picks and closes; Escape closes and returns focus to the trigger; Tab and an outside pointer close | Tile only, name visually hidden; tip = org name; menu 260px |
| Account capsule | `.acct` `aria-haspopup="menu"`, name = name + email; list `aria-label="Account"`; gear `aria-label="Settings"` | As the org switcher; the gear is its own tab stop | Stacked; tips = user name and "Settings"; menu opens upward, 220px |
| Platform stamp | `button`, `aria-label` "{label} v{version}, What's new"; mark `aria-hidden` | Enter opens the drawer; focus returns here on close | Version visually hidden; tip "{label} v{version}" |
| Top bar | `header`; breadcrumb `nav aria-label="Breadcrumb"`, current `aria-current="page"`; search `aria-label` + `aria-keyshortcuts` | Meta+K or Ctrl+K focuses and selects search | none |
| Notifications | Bell `aria-label` "Notifications, N unread", `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`; panel `role="dialog"` `aria-labelledby` its `h4`; rows in a `ul`; unread rows carry a visually hidden "Unread" | Opening focuses Mark all read when enabled, else the first row, else the panel; Escape closes and returns focus to the bell; tabbing out or an outside pointer closes | Count and dot `aria-hidden`; state never by color alone (wash + dot + word) |
| Guides | `aria-label` "Guides" or "Guides, What's new unread"; `role="menu"` `aria-label="Guides"`; What's new carries a visually hidden "Unread" | As a menu; picking What's new closes the menu, refocuses the guides button, then opens the drawer | Dot `aria-hidden` |
| What's new drawer | `role="dialog"` `aria-modal="true"` `aria-labelledby` its `h4`; close `aria-label="Close"`; each release a `section` named by its version; dates in `<time datetime>` | Opening focuses Close; the body `.drawer-bd` is a named region with `tabindex="0"` ("Release notes"), so Tab reaches it and arrows scroll it; Tab and Shift+Tab stay inside; Meta+K, Ctrl+K and `[` do nothing while it is open; Escape, Close or a scrim click closes; focus returns to what opened it | Scrim fades in `--dur-1`, sheet slides 16px in `--dur-2`; both off under reduced motion |
| Rail tip | `aria-hidden="true"` (the names live in the controls) | Shows on hover and on keyboard focus; Escape hides it; it stays while the pointer is on it; hides on blur, scroll and expand | No animation |

Titles inside these parts are `h4` and release versions `h5`, never `h2`. Every decorative `svg`
carries `aria-hidden="true"`.

**Rules: storage, unread, shortcuts**

- **Last seen:** `localStorage['verseva.whatsnew.seen']` holds the version last opened (as passed,
  e.g. `0.3.0`); an app may rename the key.
- **Unread:** while the last-seen version is missing, invalid or older than the platform version
  by SemVer. Never unread when the platform version is invalid.
- **Marked seen:** opening What's new, from the guides menu or the platform stamp, writes the
  platform version at once; the dot, the menu dot and the "unread" words go in the same render.
- **Bright and seen releases:** last-seen is read when the drawer opens. Newer releases render
  bright, older ones `.rel.seen`; on a first visit only the newest is bright.
- **Releases shown:** only versions at or below the platform version, newest first (notes staged
  ahead of a deploy never show).
- **Collapse:** `localStorage['verseva.shell.collapsed']` is `'1'` (rail) or `'0'`; absent means the
  app's default.
- **`[` toggles the rail.** Ignored while typing (inputs other than checkbox, radio and button
  types, `textarea`, `select`, contenteditable, `role` textbox, searchbox, combobox or
  spinbutton), with Meta, Ctrl or Alt held, on key repeat, during IME composition, or when the
  event is already handled.
- **Meta+K / Ctrl+K** focuses and selects search, also while typing elsewhere. The kbd chip reads
  `⌘K` on Apple platforms and `Ctrl K` elsewhere.
- **Storage failure** (private mode, blocked storage, server render) never throws; every read
  falls back to the default.
- The accordion's `verseva.nav.shut` key is unchanged.
- **Counts:** the badge floors first, so `0.5` shows no badge and `99.5` shows `99`; above 99 it
  reads `99+`.
- **Dates:** an impossible ISO date such as `2026-02-30` renders as given, never rolled into the
  next month.
- **Version:** What's new needs a valid SemVer platform version; an invalid one shows no releases
  and never the unread dot.
- **Placement:** render What's new as a sibling of the shell, never inside a transformed or
  filtered ancestor, which would trap the fixed drawer.
- **Long feeds:** pass the latest page of notifications (about 50) and use View all for the rest;
  the panel and the drawer render every item they are given.
- **Strings:** every built-in label is a `labels` prop with English defaults; the collapse row's
  name and rail tip follow `collapseLabel`.
- **Platform mark:** one `currentColor` SVG, or a pair `.on-dark` and `.on-light` (raster marks)
  swapped by `[data-theme="light"]`.
- **Scope:** release internals (`.rel`, `.relhead`, `.chgs`, `.chg`) apply inside `.drawer` only,
  and `.who` inside `.acct` only; the part roots (`.cshell`, `.cside`, `.switcher`, `.capsule`,
  `.platform`, `.tbar`, `.drawer`, `.scrim` and the rest) are global class names.
- **Direction:** the shell is left-to-right in 1.3.0; right-to-left layout is a stage 2 item.

## Live activity: `.lact`, `.lact-panel` (1.6.0)

A capsule for long jobs (deploys, agent runs, imports) in the top bar's `.tbar-end`, before the
notifications bell, with a panel listing every job. The React copy (`npx verseva add live-activity`)
renders exactly this DOM; its rules live in `activity-state` (pure, tested).

**Data:** products push `{ id, name, steps?, progress, done?, error? }[]`; `progress` is 0..1, and
`null` or missing means not known yet (the loading state). `error` is a message or `true`.

**Anatomy**

| Part | Classes | Holds |
|---|---|---|
| Wrapper | `.menu.end.lact-wrap` | Hidden while there are no jobs and the panel is shut |
| Capsule | `button.lact[data-state]`, `.lact-ring` (`.lact-track`, `.lact-arc`, `.lact-ti`), `.lact-tx` (`.lact-name`, `.lact-pc`), `.lact-more` | Glass pill, 34px: the lead job's ring, name and percent; `+n` running |
| Panel | `.menu-list.panel.lact-panel`, `.panel-hd` (`h4`, Clear done), `ul.lact-list` > `li.lact-item[data-state]` | Non-modal dialog, 360px; one row per job |
| Row | `.lact-top` (state icon, `b` name, `.lact-pc`), `.lact-bar` > `i`, `.lact-step` or `.lact-err`, `.lact-acts` | Name and percent, bar, current step or the failure line, Cancel (running) or Retry (error) |
| Empty | `.lact-panel .panel-empty` | "No activity" when the last job goes while the panel is open |

`data-state` is `pending`, `running`, `done` or `error` (`empty` on the capsule with no lead).

**Rules**

- **Lead:** the running job closest to done; a job with known progress beats a pending one; ties
  keep list order. With nothing running, the first failed job leads, then the first done job.
- **`+n`** counts running jobs other than the lead. Done and failed jobs never count.
- **Percent** is floored, so a running job never reads 100% before it is done.
- **Done leaves** the capsule 6 seconds after it finishes (`leaveDelay`), never while the panel is
  open; closing the panel restarts the delay, so nothing vanishes the instant it shuts. `onDone`
  fires once per job: write a notification there so the result can be found later. **Remove a done
  job only after `onLeave`**; a removal is never read as a cancel unless Cancel was pressed for it.
- **First render is silent:** the list a capsule mounts with is its baseline, so a remount
  announces nothing and fires no `onDone` (no duplicate notifications).
- **Ids are unique.** A duplicate id keeps the last job pushed (one row, one count) and logs a
  warning outside production.
- **Errors never auto-leave.** The row shows the failure line and Retry.
- **Rows update in place** (keyed by `id`): the bar scales, the step and percent change, nothing
  re-mounts.

**Material, color and contrast**

- The capsule restates the glass material (`--surface-body` over `--glass-fill-3`, `--glass-border`,
  `--glass-inset`, `--e-1`) at `--r-pill`. The panel is the notifications panel's `--surface`, rows on
  `--surface-2`.
- **No accent** (law 3 budget). Ring and bar draw `--text-1` while running, `--success` when done,
  `--danger` on error, on a `--data-0` track. Done and error also tint the capsule border and show a
  check or cross: state is never color alone.
- Capsule name `--text-1`, percent `--text-2`, both over the worst-case catch-light; row text
  `--text-1`, step, failure line and `+n` `--text-2`. No `--text-3` text anywhere in the part.
  `test/live-activity-css.test.mjs` measures every pair, both modes, base and the four presets.

**States**

| Part | Hover | Focus-visible | Press | Disabled | Loading | Done | Error | Empty |
|---|---|---|---|---|---|---|---|---|
| Capsule | `--hairline-strong` border; `aria-expanded="true"` holds it | 2px `--focus` at 2px | scale .97 | `:disabled` or `aria-disabled` at .45 | quarter arc turns, "Starting" | `--success` ring, border and check, "Done" | `--danger` ring, border and cross, "Failed" | hidden |
| Row | buttons as `.btn` | buttons as `.btn` | as `.btn` | as `.btn` | a 30% sliver slides, no `aria-valuenow` | full `--success` bar, check, "Done" | full `--danger` bar, cross, failure line, Retry | `.panel-empty` |

**Phone:** under 900px the panel is a bottom sheet (fixed to the bottom, top corners `--r-lg`, a grab
bar, safe-area padding, up to 70dvh) and the capsule caps at 180px; under 600px the job name is
visually hidden (the capsule's name still carries it). On a coarse pointer the capsule is 44px tall.

**Motion:** the arc eases its `stroke-dashoffset` (`--dur-3`), the bar scales on `transform`, the
check pops on `--ease-back`; no width animation. Reduced motion drops every transition, the press
and both loading animations.

**Accessibility**

| Part | Roles and names | Keyboard and focus |
|---|---|---|
| Capsule | `button`, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`; name "Live activity: {job}, {n}%, {m} more running, {k} failed"; the visible text, ring and `+n` are `aria-hidden` | Enter or Space opens the panel |
| Panel | `role="dialog"` `aria-labelledby` its `h4`; each bar `role="progressbar"` named by its job with `aria-valuenow` (none while pending) | Opening focuses Clear done when enabled, else the first Cancel or Retry, else the panel; Escape closes and returns focus to the capsule (or the next top bar control when the capsule has gone); tabbing out or an outside pointer closes; after Cancel or Retry focus stays in the panel |
| Live regions | a polite `role="status"` and a `role="alert"`, both visually hidden, outside the wrapper so they outlive the capsule | Status: "{job} started", "{job} done", "{job} cancelled" (a running job removed after its Cancel) and "{job} 25%", 50%, 75% only; alert: "{job} failed: {message}". Any other removal is silent. Each message replaces the region's content node, so a repeat of the same words is read again |

Every built-in string is a `labels` prop with English defaults (`ACTIVITY_LABELS`).

## Command bar: `.cmdk` · three-column top bar (1.6.0)

Meta+K or Ctrl+K opens one bar for actions, go-to, recent items and questions. The React copy
(`npx verseva add command-bar`) renders exactly this DOM; `command-state` holds the rules.

**Contract:** `commands: { group, label, icon?, hint?, keywords?, disabled?, run }[]`, optional
`onAsk(question, { signal }) => AsyncIterable<string> | { text, widget? }` (or a promise of
either; a `widget` property on the iterable shows once the stream ends), optional
`onPin({ question, text, widget })`. `open`, `onOpenChange` or `defaultOpen`;
`shortcut` (default true); every word a `labels` prop.

**Anatomy**

| Region | Classes | Holds |
|---|---|---|
| Trigger | `button.searchbox.cmdk-trigger` | Search icon, label, K chord; sits in the top bar's search slot |
| Overlay | `.cmdk-ovl` > `.cmdk` | Scrim and a 620px glass panel at `--r-lg`, 12vh from the top |
| Field | `.cmdk-field`, `.cmdk-input`, `.cmdk-mode`, `.cmdk-kbd`, `.cmdk-close` | Combobox input, "Ask" chip while the Ask row shows, esc chip; on phone a 44px Close (`aria-label="Close"`) replaces the esc chip |
| Results | `ul.cmdk-list` > `.cmdk-group` + `ul[role=group]` > `.cmdk-opt` (`.ask`), `.cmdk-label`, `.cmdk-hint`; `.cmdk-empty` | Ask row first in its own group, then groups in the order they first appear |
| Answer | `.cmdk-ans` > `.cmdk-q`, `.cmdk-load` (`.skel` x3), `.cmdk-a` + `.cmdk-caret`, `.cmdk-err`, `.cmdk-widget`, `.cmdk-acts` | Question, loading lines, streamed text, error with Retry, widget preview, Pin to Home and Ask another |
| Footer | `.cmdk-ft` | Key hints; `aria-hidden`, gone on phone |

**Rules**

- **Filtering:** every word of the query must appear in the label, group or keywords; case,
  accents and curly apostrophes fold. Commands keep their order inside a group.
- **Ask row:** shows for a trailing `?`, a leading question word (what, how, why, when, where,
  which, who, is, are, do, does, did, can, could, should, will, would and kin), Tab, or no
  matches. Never without `onAsk` and never on an empty query. Without `onAsk`, no matches is the
  no-results state ("No results").
- **Selection** wraps at both ends and skips disabled options.
- **Running a command** closes the bar, returns focus, then calls `run`.
- **Answers:** an async iterable streams chunk by chunk; `{ text, widget? }` shows at once.
  Typing during an answer drops it and returns to the list (late chunks are ignored and the
  signal aborts). A throw or rejection is the error state.
- **Accent budget:** the Ask row's icon is the list view's one accent; in an answer it is the
  Pin to Home primary. The Ask chip is neutral.
- **No `--text-3` on the panel:** group labels, hints, placeholder, question, empty state, kbd
  chips and footer are `--text-2`.

**States**

| Part | Hover | Focus-visible | Press | Disabled | Other |
|---|---|---|---|---|---|
| Trigger | `--hairline-strong` border | 2px `--focus` at 2px | sits down 1px | `:disabled` at .45 | |
| Option | 6% `--text-1` wash | the active option takes a 2px inset `--focus` ring while the field has focus | sits down 1px | `aria-disabled="true"` at .45, no wash, never selected | active: `aria-selected="true"` on `--surface-2` |
| Answer | | | | | loading: three `.skel` lines + "Thinking" (read); streaming: `aria-busy="true"` + caret; error: `.cmdk-err` `role="alert"`, `--danger` icon, the words, Retry |
| List | | | | | empty: `.cmdk-empty` "No results" in `--text-2` |

Reduced motion: motion is opt-in under `prefers-reduced-motion:no-preference` (panel rise,
scrim fade, option and trigger transitions, caret blink); otherwise the bar appears in place and
the caret holds still. Phone (below 600px): a full-height sheet with no radius and no footer; Close in the field row closes it.
Options are at least 44px tall. `.cmdk-ovl` stacks at 19, above the drawer (17) and the skip
link (18).

**Accessibility**

| Part | Roles and names | Keyboard and focus |
|---|---|---|
| Trigger | `button`, name = its label, `aria-haspopup="dialog"`, `aria-keyshortcuts` | Click or Meta+K / Ctrl+K opens; the chord also closes, also while typing elsewhere, and stands down while another `aria-modal` dialog is open |
| Panel | `role="dialog"` `aria-modal="true"` `aria-label="Command bar"` | Opening focuses the field; Tab and Shift+Tab stay inside; Escape, Close or a scrim click closes; focus returns to what opened it; keys do nothing during IME composition |
| Field | `role="combobox"`, `aria-controls` the listbox, `aria-expanded`, `aria-autocomplete="list"`, `aria-activedescendant` the active option | Up and Down move; Enter runs; Tab (with text, before an answer) forces the Ask row |
| Results | `role="listbox"` named "Commands"; groups `role="group"` named by their heading; `role="option"` + `aria-selected`, `aria-disabled` | Pointer movement selects; a click runs; options never take focus |
| Status | one visually hidden `role="status"` | Reads the result count (commands only, never the Ask row) as you type, nothing while an answer streams, then the finished answer once |
| Answer | `section` named "Answer", `aria-busy` while loading or streaming; error `role="alert"` | Retry and Ask another return focus to the field |

**Top bar:** `.tbar` becomes a three-column grid only when it holds a `.searchbox` as a direct
child (`.tbar:has(>.searchbox)`): breadcrumb left, search centred at up to 360px, actions right
at their natural width. Under 900px the search takes the free track; under 600px the breadcrumb
hides and the search takes the first track. This applies to every top bar with a search,
shipped 1.3 consoles included. Every other top bar keeps the 1.3 flex row.

**Placement:** render `CommandBar` as a sibling of the shell, never inside `.tbar` (its sticky
stacking context would trap the overlay); put `CommandBarTrigger` in the top bar's `search`
slot. Mount one K-chord owner: pass `shortcut={false}` to `ConsoleSearch` if both are present.

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

## Widgets: `.wgrid`, `.wtile`, `.wstack`, `.wgal` (1.6.0)

An adaptive home: a grid of tiles, each picking its view from its size. React parts
(`npx verseva add widget-grid smart-stack`) render exactly this DOM; the rules live in
`react/widget-state.ts`, pure and tested.

**Grid and sizes**

| Columns | Viewport | Largest size | Notes |
|---|---|---|---|
| 4 | 1100px and up | XL | |
| 2 | 560 to 1099px | L | XL shows its L view |
| 1 | under 560px | M | L and XL show their M view |

S is 1x1, M 2x1, L 2x2, XL 4x2 on 180px rows with `--s-4` gaps (`--s-3` in one column). A size
that does not fit drops to the largest supported size that does (`fitSize`); the tile carries the
fitted size in `data-size`. Flow is sparse (`grid-auto-flow: row`, never dense), so DOM order,
focus order and visual order agree.

**Anatomy**

| Part | Classes | Holds |
|---|---|---|
| Grid | `.wgrid` (`[data-editing]`), a polite live region | `role="region"` named Widgets |
| Tile | `.wtile[data-size]` (`[data-focus]`, `[data-dragging]`, `aria-busy`, `aria-disabled`), `.wtile-body` | `role="group"` with `aria-roledescription="widget"`, named "Revenue, large"; glass at `--r-lg` |
| Content | `.wtile-hd` (+ `svg`), `.wtile-meta`, `.wtile-num`, `.wtile-sub`, `.wtile-rows` > `.wtile-row` (+ `b`, `.wtile-val`), `.wtile-foot` | Header, numeral, caption, rows, footer |
| Loading | `.wtile-skel` > `.skel`, `.wtile-skel-num`, `.wtile-skel-plot` | A copy of the widget's layout at its size |
| Error | `.wtile-err` > `.wtile-errline` (+ `svg`), Retry `.btn.btn-secondary.sm` | The failure line (`role="alert"`) and Retry |
| Empty grid | `.wgrid-empty` (`b` + `.btn.btn-secondary`) | "No widgets" and Add widget, labels only |
| Edit controls | `.wtile-x`, `.wtile-handle`, `.wtile-edit` > `.wtile-move` + `.wtile-sizes`, `.wgrid-add` | Remove, touch drag handle, Move up and down, size buttons, Add widget slot |
| Undo | `.wgrid-undo` > `.toast` + `.btn.btn-ghost.sm` | One toast after a remove; waits while hovered or focused |
| Smart stack | `.wstack` > `.wstack-pages` > `.wstack-page[data-pos]`, `.wstack-nav` > `.wstack-pause` + `.wstack-dot` | Several widgets in one slot |
| Gallery | `.scrim` + `.drawer` > `.drawer-bd` > `ul.wgal` > `.wgal-item` (`.wgal-icon`, `.wgal-name` + `small`, `.wgal-sizes`) | Every kind with its sizes as add buttons |

**Accent budget (law 3, one accent per view).** Charts in a tile draw on the text ladder: the viz
kit's accent marks (`.bar .fill`, `.hbar .htrack i`, `.ring .ringfill`, the heat and activity
levels, the legend, and any SVG `stroke`, `fill` or `stop-color` of `var(--data-3)`) are recoloured
to `--text-1`, `--text-2` and a 30% `--text-1` mix in every tile except the one the product marks
`focus`. The second series keeps `--data-alt`. An inline `style` that names an accent rung (for
example `Bars` with `level`) cannot be recoloured, so it spends the accent wherever it renders.
`test/widgets-css.test.mjs` fails a new accent rule without a neutraliser;
`studio/test/widget-grid.test.tsx` counts accent-bearing elements across a rendered grid (at most
one tile, the focus one) and across a whole console view, against the law 3 budget: the one primary
action, the active nav bloom, and at most one focus widget's data marks. Counts, badges and dots
(`.ibtn .num`, `.ibtn .dot`, `.notif .udot`, `.mhint .newdot`) and the What's new New tag (`.badge.bloom`) are
neutral on the text ladder.

**Edit mode** (an Edit button the product owns, a 550ms long-press on a tile, or the command bar).
Esc leaves when focus is in the grid, on the Edit toggle (`toggleRef`) or nowhere, never from another
part of the page or an open dialog, and focus moves to the toggle.

- Jiggle is rotation only (`wtile-jiggle`, `--dur-3`), off under reduced motion. Content goes to
  .4 and is `inert`; tiles become tab stops with `aria-keyshortcuts`.
- Remove badge top left; after a remove focus moves to the next widget (else the previous, else
  Add widget) and Undo lives in the toast.
- Size control: `aria-pressed` buttons (not a tablist). Sizes that do not fit stay visible with
  `aria-disabled` and do nothing.
- Reorder three ways: HTML drag on the tile (pointer devices); the handle (`pointer: coarse` only,
  `touch-action: none`, pointer capture) plus Move up and Move down (one slot); Alt+Arrow on a
  focused tile, Left and Right one slot, Up and Down swap with the tile one row above or below;
  the opposite key swaps back with the same partner, so Down then Up round-trips at any size.
  The Move buttons keep focus after the move.
- Every hit area is 44px: the 28px badges sit in 44px buttons, stack dots are 44px buttons.
- Announcements: "Revenue moved to position 3 of 8", "Revenue resized to large", "Revenue
  removed", "Revenue restored", "Revenue added".

**Smart stack.** A horizontal wheel (at least 24px and twice the vertical delta, 450ms step; only
then is the default prevented), a 40px horizontal swipe (`touch-action: pan-y`, so vertical
gestures scroll the page), the dots, or a timer
(6s) that pauses on hover, on focus inside, through the visible pause button, while the page is
hidden, and from outside (`paused`, e.g. in edit mode); no timer and no pause button under reduced
motion (WCAG 2.2.2). `aria-roledescription` carousel and slide; hidden pages are `inert`; the
pages announce politely only after a person moves them. The tile body drops its padding around a
stack. Up to three pages show dots; above three, Previous and Next replace them, so pause plus
the nav always fits a one-row tile.

**Material and contrast.** The tile restates the glass material at `--r-lg` (like `.cside`, it
does not compose `.glass`). No `--text-3` anywhere in the section: on glass the floor is
`--text-2`. Edit controls sit on opaque `--surface-2` pills; the remove hover is `--danger` on
`--danger-bg` over `--surface` (a gated pair).

**States**

| Part | Hover | Focus-visible | Press | Disabled | Other |
|---|---|---|---|---|---|
| Tile | `--hairline-strong` border | 2px `--focus` at 2px (edit mode) | scale .98, jiggle stops | `aria-disabled` at .45, body inert | `aria-busy` skeleton; error line + Retry |
| Remove, handle | danger wash / `--surface` | 2px `--focus` inset | badge scales .92 | .45 | |
| Size, move buttons | 6% `--text-1` wash | 2px `--focus` inset | sits down 1px | `aria-disabled` at .45, no wash | pressed: `--surface` + `--e-1` |
| Add slot | `--text-1`, `--text-2` border | 2px `--focus` at 2px | sits down 1px | .45 | |
| Stack dot, pause | dot to `--text-1` / `--text-1` | 2px `--focus` inset | dot .8 / scale .94 | .45 | current dot `--text-1`, taller (shape, not colour alone) |
| Gallery size buttons | `--surface-2` | 2px `--focus` inset | sits down 1px | `aria-disabled` at .45 | |

**React contract.** `WidgetDefinition { kind, name, icon?, sizes, render(size, state), skeleton? }`
where `state` is `{ size, focus, editing, columns }`; layout `{ id, kind, size }[]`, controlled
(`layout` + `onLayoutChange`) or uncontrolled (`defaultLayout`, stored under
`verseva.widgets.layout` after mount; `storageKey={null}` turns it off; a stored `[]` stays empty, a
stored list with no valid item falls back to `defaultLayout`). `columns` forces a column count and writes `data-cols`, which
the CSS follows over the breakpoints. Ids from `addWidget` are never reused. `status` maps an id to
`{ loading?, error?, disabled? }`; `onRetry(id)`. `parseLayout` drops items with an unknown kind,
an unsupported size or a duplicate id, and returns null for anything that is not a JSON array or for a non-empty list with no valid item.

## Specimen rule

Every component appears in the studio in every contract state, per theme. A theme that styles a
component updates its studio specimen in the same change (sync rule).
