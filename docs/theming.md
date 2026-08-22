# Theming

The package ships the VERSEVA signature as the default. A brand joins by THEME: a `theme.css` of
value overrides living WITH the brand (its skills pack or its repo), never inside this package,
plus a human-readable `design-register.md` beside it recording posture, ratification, and stated
deviations. Roles and the contract are never redefined by a theme.

## The two cuts

| Cut | Who | What they inherit |
|---|---|---|
| **FULL signature** | Owned surfaces | Everything: craft roles + the soft-glass material values as shipped |
| **CRAFT signature** | Partner / white-label surfaces | The skeleton, laws, quality floors, and moves; the partner's values on top; **no credit line** on the surface |

Partner theme files stay under partner org paths. Never conflate ownership.

## Authoring a theme

1. Scope every override under `[data-brand="<slug>"]`, with a
   `[data-brand="<slug>"][data-theme="light"]` flip block. The app opts in via
   `<html data-brand="<slug>">`; the light/dark axis stays `data-theme`.
2. Re-value only. Fill accent, functional set, faces, weights, radius mapping (`--r-*`,
   `--r-btn`), elevation. Check every value against the contrast floors before ratification;
   mark unratified values **PROPOSED** in the register.
3. **Bans must null.** A theme that bans a material (e.g. no glass, no bloom) overrides the
   material tokens to inert values (`--glass-blur:0`, `--accent-bloom:none`, …). Values agreeing
   while materials disagree is the recorded failure mode.
4. **Deviation is a decision.** Every departure from the signature carries a stated reason in
   the register (posture, material, faces). Silence means inherited unchanged; say so with an
   "inherited roles" table so an unmentioned role is distinguishable from an overlooked one.

## Onboarding checklist (a theme is not live until all five)

1. `theme.css` at the brand's home, scoped as above.
2. `design-register.md` beside it (posture, values, component notes, bans, PROPOSED list).
3. A row in the machine-local `board/theme-manifest.json` pointing at the file (copy
   `theme-manifest.example.json`; the board pulls copies via `npm run board`; the brand home
   stays canonical).
4. The board renders it: switcher entry works in both modes, live contrast pairs pass, bans
   actually null (click the brand and look).
5. The brand's state file records the theme location.

## Consuming

```css
/* Tailwind v4 app (globals.css) */
@import "tailwindcss";
@import "@verseva/design/tailwind.css";
@import "../path-to-brand/theme.css";   /* or copy it into the repo it themes */
```

```css
/* Framework-light surface (deck, artifact, static page) */
@import "@verseva/design/tokens.css";
@import "@verseva/design/components.css";
```

Non-JS surfaces (decks, artifacts) inline the same `tokens.css` content instead of importing.

## Enforcement

Wire the hex gate into the consumer's build so off-token hexes fail it:

```json
"scripts": {
  "lint:hex": "verseva-hex-gate --tokens node_modules/@verseva/design/tokens.css --tokens src/app/theme.css src",
  "build": "npm run lint:hex && next build"
}
```

Ratified exceptions carry `hex-ok` on the line with a reason in the adjacent comment.
