# Proposal: accent budget (law 3), for 1.4.0

Status: RATIFIED P1 + P2 (Xhunn 2026-10-31, "Approve defaults"); build after Studio R3 (2026-11-01). Branch `proposal/accent-budget` from main bf9a42a (1.3.1). No CSS changed yet.
Source: NEMIXO Studio audit 2026-10-31 (pick A1). Ruling it follows (Xhunn, 10-31): a change to the base is made here,
for every product, never as a product-local override.

## Problem

Law 3 says "one accent" and design-core says "one accent per view, with a usage budget", but no budget is written, and
the package itself spends the accent in six places. On one Studio view (CandyCeuticals, Blogs, 1.3 console shell) the
accent shows seven times: brand tile, active nav bloom plus its glow, the pressed "All" filter chip, the primary button,
the notification count, the unread dot. A red danger badge (Blocked) sits beside them, and with a red brand accent the
two roles read as one.

Where the package spends it today:

| Recipe | Line (components.css 1.3.1) | Spend |
|---|---|---|
| `.snav a[aria-current="page"]` | 228 | `--accent-bloom` plus `--accent-active-glow` |
| `.tab.on` | 191 | bloom plus glow |
| `.snav .cnt.hot` | 256, 408 | bloom (collapsed: solid accent dot) |
| `.fchip[aria-pressed="true"]` | 140 | 14% accent fill, 36% accent border |
| `.badge.bloom` | 393 | bloom |
| `.btn-primary` | (law 3 matte body) | the primary |

Internal tension: law 3 bans a colored outer glow on accent controls, yet `--accent-active-glow` (tokens.css 122, 171)
is a colored outer glow on the active nav item and tab.

## Options

| | Change | Effect | Call |
|---|---|---|---|
| P1 | Write the budget into law 3: per view, the accent appears on the ONE primary action and the active nav or tab (the named bloom device). Selection inside content (filter chips, segmented pressed states), counts and info badges use the neutral pressed state. Danger and status keep their own roles. | Every product calms down at once, the signature device stays | **Recommended** |
| P2 | Set `--accent-active-glow: none` in both modes; the bloom stays, contained inside the item's radius | Removes the smear and the law 3 contradiction | **Recommended, with P1** |
| P3 | Retire the bloom as a named device (neutral fill plus a 2px accent rail) | A signature change: every product loses its most recognizable move | Not recommended |
| P4 | Leave it, let each product budget its own call sites | The exact local-override drift the 10-31 ruling forbids | Rejected |

## P1 + P2 change set (to build only after the ruling)

1. `docs/laws.md` law 3: add "Budget: one primary action and the active nav or tab per view. Content selection, counts
   and info badges are neutral." with the amendment date.
2. `tokens.css`: `--accent-active-glow: none` (light and dark).
3. `components.css`: `.fchip[aria-pressed="true"]` becomes `background: var(--surface-2); border-color: var(--hairline-strong);
   color: var(--text-1); font-weight: 600`; `.snav .cnt.hot` becomes neutral (`var(--surface-2)`, `--text-1`, 600), the
   collapsed dot becomes `--text-1`; `.badge.bloom` stays but the contract names it as a nav-or-tab-only badge.
4. Contract and board: `docs/component-contract.md` states for chip, count and badge; `site/components.html` and
   `site/examples.html` specimens re-rendered light and dark; contrast gate re-run (the neutral pressed chip must still
   hold 3:1 against an unpressed chip as a UI part).
5. Release 1.4.0 (minor: visible change, no API change), CHANGELOG entry with a migration note for products that COPY
   recipes rather than import them.

## Consumers to update after release

| Product | How it takes the change |
|---|---|
| NEMIXO Studio | Bump the pin; its `app/studio-recipes.css` copies `.fchip` as `.fchip[aria-current]` and must re-copy |
| NEMIXO App (acb-quote) | `src/app/console-shell.css` copies shell recipes rule for rule: re-copy |
| NEMIXO ID (accounts.nemixo.com) | Bump the pin |
| verseva.com | Bump the pin; check `.tab.on` usage |

## Open questions

- Q1: Should danger diverge from a red brand accent automatically (a theme-level check that warns when `--accent` and
  `--danger` sit within a hue distance)? Default: add a board warning only.
- Q2: Brand tile in the org switcher: keep the accent fill (identity, not action)? Default: keep; it is the brand's mark.
