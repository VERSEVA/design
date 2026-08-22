# Token architecture

Role-based: every token is a ROLE with a fixed meaning; `tokens.css` supplies the signature
values, brand themes override values via `[data-brand]` blocks (see `theming.md`). Roles are
fixed portfolio-wide; a brand that needs a new role proposes it here first, for every brand,
or it does not exist.

Rendered at `board/index.html` (sync rule: any change here or in `tokens.css` updates the
board in the same change; the markdown and CSS are the source, the board is the render).

## 1. Color roles

Values: see `tokens.css` (dark default, `[data-theme="light"]` flip block).

| Role | Meaning |
|---|---|
| `--bg` | Page floor |
| `--surface` / `--surface-2` | Card / raised or nested surface |
| `--hairline-soft` / `--hairline` / `--hairline-strong` | Divider ladder: recessive / default / emphasis-hover |
| `--text-1` / `--text-2` / `--text-3` | Text ladder; `--text-3` labels/captions only, never body |
| `--accent` / `--accent-hover` / `--accent-ink` | THE brand action color (one per brand), its shift, ink on it |
| `--focus` | Focus ring |
| `--success` / `--warn` / `--danger` (+ `-bg` tints) | Status fg / tint pairs |
| `--accent-2` | Optional: secondary color, informational emphasis only, never action |
| `--highlight` | Optional: non-text marker device |

### Color rules

- **Dark foundations are the default.** A theme may declare itself light-native with a stated reason.
- **Accent budget:** primary actions, key emphasis, signature moments. Rough ceiling: one
  accent-colored cluster per viewport. One accent per view.
- **Contrast floors (contract):** `--text-1`/`--text-2` on `--bg` and `--surface` ≥ 4.5:1;
  `--accent-ink` on `--accent` ≥ 4.5:1; `--text-3` and large display ≥ 3:1; non-text meaningful
  parts ≥ 3:1.
- **Muted and earned:** no saturated-for-attention values.
- **Status is never color-alone:** pair with icon or text.
- **Ladder discipline:** grays come from the canvas/hairline/text ladders, never ad-hoc values.
- **Hairlines are decoration, not contract-bearing UI parts.** Every hairline step sits far below
  3:1 by construction. A boundary that makes a control a control, or a stroke carrying meaning,
  comes from the TEXT ladder (`--text-3` or above) or the shape carries a fill.

## 2. Type roles

Scale ~1.25 on a 16px base; themes may tune ratio within 1.2–1.333 and must supply premium faces
on customer-facing surfaces.

| Role | Size | LH | Weight | Tracking |
|---|---|---|---|---|
| `display` | clamp(2.6rem, 6vw, 4.4rem) | 1.05 | var(--display-weight) | -0.02em |
| `h1` | 2.44rem | 1.1 | var(--display-weight) | -0.015em |
| `h2` | 1.95rem | 1.15 | var(--heading-weight) | -0.01em |
| `h3` | 1.56rem | 1.25 | 600 | 0 |
| `body-lg` / `body` | 1.125rem / 1rem | 1.55 / 1.6 | 400 | 0 |
| `small` / `caption` | 0.875rem / 0.75rem | 1.5 / 1.4 | 400 / 500 | 0 / +0.01em |
| `label` | 0.6875rem | 1.2 | 500 | +0.08em, UPPERCASE, mono |

- Max 2 families per brand + optional mono for labels. One `h1` and at most one `display` per page.
- **TYPE LAW (mono-is-for-machines):** mono only for machine artifacts (IDs, codes, SKUs,
  payloads, code inputs), live timers/stage displays, chart-internal microlabels ≤10px, and
  pure-number identity chips. Everything a human reads is body. Never uppercase tracked-out mono
  footnotes.
- Line length 45–75ch body, 65ch target (`--container-prose`).

## 3. Spacing

4px base; the `--s-1..10` scale is the only source of spatial values; off-scale pixels are drift.
Marketing section rhythm: floor `--s-9`, standard `--s-10`. Product surfaces: section gaps
`--s-5`/`--s-6`; card padding `--s-4`/`--s-5`/`--s-6` by density.

**SEAM LAW (sections-must-breathe):** on product surfaces, section→section ≥18px (32 standard,
20 tight); stacked cards in one panel ≥12px; a full-width button after a list ≥14px. Rhythm at
class level, never per-screen inline margins.

## 4. Radius

`--r-sm` inputs/chips · `--r-md` buttons/panels · `--r-lg` cards/modals (sheets may run 26–30) ·
`--r-pill` pills/avatars · `--r-btn` button mapping. Signature posture is **soft-large**
(controls 9–13, cards 20–26). Themes declare ONE posture and map the roles to it.

## 5. Elevation

Hairline-first: structure from borders, shadows reinforce (`--e-1/2/3`). On dark, elevation also
lightens the surface, never shadow-alone. A theme may define a signature shadow device with an
explicit emphasis-only budget.

## 6. Motion

`--dur-1..4` + the four easings. Animate transform and opacity only; honor
`prefers-reduced-motion`; press feedback on tactile controls = scale(.92–.97) at
`--dur-1`/`--ease-standard`. No unnamed magic numbers.

## 7. Data-visualization

`--data-0..3` single-hue magnitude ladder (accent at 0/36/64/100%): volume, never type. Status
colors stay reserved. Categorical series: fixed order, max 5. `--chart-grid` recessive,
`--chart-label` mono ≤10px.

## 8. Signature material (soft-glass)

The VERSEVA surface language: soft (rounded, pressable, soft-shadowed) converged with glass
(light, translucency, air), lit by ONE overhead light source. Roles: `--glass-fill-3`,
`--glass-border`, `--glass-blur`, `--glass-sat`, `--glass-shadow`, `--glass-glow`,
`--glass-inset`, `--surface-body`; navshell tiers `--nav-gap`, `--nav-frame`, `--nav-main`,
`--nav-pill-inset`; accent devices `--accent-on`, `--accent-bloom`, `--accent-active-glow`,
optional `--accent-fill` / `--accent-fill-hover` (matte gradient primaries, no colored outer glow,
label AA held).

Richness comes from material, light, edge, and curve, NOT decorative gradients.
**matte-is-not-flat**; **nav-tier-brightness is mode-specific** (see `laws.md`). A theme that
bans the material (opaque brands) must NULL these tokens, not just skip them: values agreeing
while materials disagree is the recorded failure mode.

## Tailwind

v4: `@import "@verseva/design-core/tailwind.css"` (maps roles into `@theme inline`; radius roles
emit as `--radius-*`). v3: `presets: [require('@verseva/design-core/preset')]`. Spacing rides
Tailwind's own 4px scale (p-1 = `--s-1` … p-32 = `--s-10`).
