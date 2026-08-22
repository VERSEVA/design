# The VERSEVA signature: laws

The signature is the soft-glass language, first proven at production scale across an
institutional console (~20 shipped waves) and a 53-screen consumer app. Dated laws, written
into the tokens; they bind every surface built on this package. Themes may deviate from the
MATERIAL with a stated, recorded reason; the craft laws (type, seams, contrast, states) are
not deviable.

1. **Material: soft-glass.** Soft (tangible: rounded, pressable, soft-shadowed) converged with
   glass (light, translucency, air), lit by ONE overhead light source: bright catch-light
   top/left, shaded hairline bottom/right. Richness comes from material, light, edge, and curve,
   NOT gradients. Dark = light-on-dark translucent fills; light = white translucency + soft
   neutral-grey shadow, no color in shadows.
2. **Color is a ladder system.** Canvas, hairline, and text ladders; roles, never ad-hoc grays.
   A surface needing a step between two ladder values is a design smell.
3. **One accent, matte.** A single desaturated accent. Accent-filled controls sit MATTE: flat
   low-contrast gradient body, whisper-thin top catch-light, NO colored outer glow, label held
   at AA. Named accent devices: the radial bloom behind the active nav item, the accent full
   stop on display headings, the single-hue data-intensity ladder.
4. **TYPE LAW: mono is for machines.** Mono only for machine artifacts (IDs, codes, SKUs,
   payloads, code inputs), live timers/stage displays, chart-internal microlabels ≤10px, and
   pure-number identity chips. Everything a human reads is body. Never uppercase tracked-out
   mono footnotes; footnotes are quiet sentence-case body.
5. **Display voice.** Tight negative tracking (-.01 to -.03em), heavy weight, short statements,
   accent full stop. Product type runs fine-grained (body 13–14px, meta 11–12.5px).
6. **SEAM LAW: sections must breathe.** Section→section ≥18px (32 standard, 20 tight); stacked
   cards in one pad ≥12px; a full-width button after a list ≥14px. Rhythm at class level, never
   per-screen inline margins.
7. **Radius posture: soft-large.** Cards 20–26, sheets 30, controls 9–13, chips pill. One
   posture per brand, applied everywhere; a theme re-postures consciously.
8. **Hierarchy comes from FILL, not size.** Primary/secondary pairs sit equal-sized;
   accent-filled vs surface-filled. Press feedback = scale(.92–.97) + shadow drop at
   `--dur-1`/`--ease-standard`.
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
    a hairline. (Navshell: copy, never approximate.)
13. **Laws are dated and live with the tokens.** Incidents become named laws written into this
    file and enforced at the pipeline (the hex gate); when a law generalizes, it lands here, not
    in one brand's theme.

Also in force from the contract: takeaway captions label the meaning, not the axis;
no-eyebrow-above-content; a header divides content, nothing sits on top of it; no doctrine prose
on built surfaces (labels, counts, and data only).
