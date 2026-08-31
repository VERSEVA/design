# The VERSEVA signature: laws

The signature is the soft-glass language, first proven at production scale across an
institutional console (~20 shipped waves) and a 53-screen consumer app. Dated laws, written
into the tokens; they bind every surface built on this package. Themes may deviate from the
MATERIAL with a stated, recorded reason; the craft laws (type, seams, contrast, states) are
not deviable. Law 14 is a posture law (commercial carriage): the one law the pipeline cannot
enforce, binding by engagement contract rather than by gate.

1. **Material: soft-glass.** Soft (tangible: rounded, pressable, soft-shadowed) converged with
   glass (light, translucency, air), lit by ONE overhead light source: bright catch-light
   top/left, shaded hairline bottom/right. Richness comes from material, light, edge, and curve,
   NOT gradients. Dark = light-on-dark translucent fills; light = white translucency + soft
   neutral-grey shadow, no color in shadows.
2. **Color is a ladder system.** Canvas, hairline, and text ladders; roles, never ad-hoc grays.
   A surface needing a step between two ladder values is a design smell.
3. **One accent, matte.** A single accent; its saturation is the brand's choice, its
   treatment is not. Accent-filled controls sit MATTE: flat low-contrast gradient body,
   whisper-thin top catch-light, NO colored outer glow, label held at AA. Named accent
   devices: the radial bloom behind the active nav item, the accent full stop on display
   headings, the single-hue data-intensity ladder. (Amended 2026-08-31: "desaturated"
   dropped; the signature accent is an energetic red, and saturation is a theme axis.)
4. **TYPE LAW: mono is for machines.** Mono only for machine artifacts (IDs, codes, SKUs,
   payloads, code inputs), live timers/stage displays, chart-internal microlabels ≤10px, and
   pure-number identity chips. Everything a human reads is body. Never uppercase tracked-out
   mono footnotes; footnotes are quiet sentence-case body.
5. **Display voice.** Tight negative tracking (-.01 to -.03em), heavy weight, short statements,
   accent full stop. Product type runs fine-grained (body 13–14px, meta 11–12.5px).
6. **SEAM LAW: sections must breathe.** Section→section ≥18px (32 standard, 20 tight); stacked
   cards in one pad ≥12px; a full-width button after a list ≥14px. Rhythm at class level, never
   per-screen inline margins.
7. **Radius posture: soft-large.** Standalone controls 10–14 (`--r-sm` to `--r-btn`); tabs
   inset in pill frames 16; product cards 14 (`--r-md`); modals and elevated surfaces 22
   (`--r-lg`); sheets 26–30; chips pill; decorative and data marks (skeletons, bar fills,
   heat cells, kbd) 4–8 and never on a control. One posture per brand; a theme re-postures
   consciously. (Amended 2026-08-31, tokens-win ruling: the shipped contract is canon; the
   former 9–13 controls / 20–26 cards band described the pre-package standard.)
8. **Hierarchy comes from FILL, not size.** Primary/secondary pairs sit equal-sized;
   accent-filled vs surface-filled. Press feedback at `--dur-1`/`--ease-standard`: `.btn` and
   full-width bar controls sit down (`translateY(1px)`); navshell tabs and icon-only controls
   compress (scale .92–.97). (Amended 2026-08-31, tokens-win ruling: the shipped contract's
   press idioms are canon.)
9. **Themes are one flip block; accent is a separate axis.** Light and dark re-value the SAME
   tokens in one scoped block; nothing per-screen. Consumer surfaces boot LIGHT by default;
   consoles carry both. Appearance and accent are independent axes.
10. **Status is ambient.** Live dots, word-carrying chips, real counts, readiness rings. Small
    text on tints still clears 4.5:1 (lifted values, not raw hues).
11. **Hairlines are decoration.** The hairline ladder sits near 1.3–1.6:1 by construction and
    never bounds a control or carries meaning in a diagram; contract-bearing boundaries come
    from the text ladder (`--text-3`+) or a fill.
12. **nav-tier-brightness is MODE-SPECIFIC.** Light: bright main pill leads on a recessed grey
    frame. Dark: INVERTED, lighter frame, darker recessed pill. Tiers separate by shade, never
    a hairline. (Navshell: copy, never approximate.) (Amended 2026-08-31, operator ruling:
    the navshell is SINGLE-tier with equal-width, always-labeled tabs and a constant height;
    the nav is the most stable object on screen. A tab's sub-sections live at the top of its
    own content as a segmented control or chip row, never as a second shell tier. Console
    navigation ships in two variants: flat grouped rows, and an accordion whose collapse is
    the hidden attribute with chevron-only motion and whose active group refuses to collapse.)
13. **Laws are dated and live with the tokens.** Incidents become named laws written into this
    file and enforced at the pipeline (the gate suite: hex, contrast, spacing, type); when a
    law generalizes, it lands here, not in one brand's theme.
14. **Signature carriage.** Named engagements carry the credit line ("Built on VERSEVA
    Design.") by default; white-label surfaces carry the craft only, no credit, unless the
    contract says otherwise. Public naming of any client engagement still requires that
    client's sign-off. (2026-08-31.)

Also in force from the contract: takeaway captions label the meaning, not the axis;
no-eyebrow-above-content; a header divides content, nothing sits on top of it; no doctrine prose
on built surfaces (labels, counts, and data only).
