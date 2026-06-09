# Prickles & Goo — Ideas Parking Lot

Running list of things to remember. Not a roadmap, not committed work.

---

## Spin-off: "Texture Mapper" — annotate any UI as prickly ↔ gooey

**The seed (jdomsin):** a separate project reusing the prickly↔gooey *spectrum*
and center-out intensity interaction, but pointed at a **website / interface**:
select parts of a page and mark them as more prickly or more gooey. Possible
use as a research tool or design-review tool.

**Why it's interesting:** most UX-feedback tools capture *good / bad / confusing*.
Prickly↔gooey is a **non-evaluative, felt-texture** vocabulary — more nuanced than
a thumbs-up, and deliberately *not* a quality score (the whole P&G project has been
fighting to keep prickly ≠ bad). It externalizes a felt sense designers struggle to
name ("why does this screen feel cold?"). P&G is the calibration engine; this is the
applied tool built on the same axis.

### Use cases to explore
1. **Design review / critique.** Reviewers tag which regions feel harsh/cold
   (prickly) vs soft/inviting (gooey). Surfaces *tonal inconsistency* — e.g. gooey
   onboarding that flips to a prickly checkout.
2. **First-impression UX research.** Show users a page; have them mark what feels
   welcoming vs intimidating. Aggregate across participants → a **texture heatmap**.
   Strong for landing, pricing, signup, error/empty states.
3. **Brand/tone audit.** Does perceived texture match *intended*? A bank wants
   warm-but-trustworthy; a security tool wants prickly-precise. Map actual vs target.
4. **Friction proxy.** Prickly clusters may track cognitive friction / intimidation
   (dense forms, jargon) — a soft signal for "where users feel pushed away."
5. **A/B tone comparison.** Overlay two designs; compare texture maps. "Variant B
   reads gooier — did conversion follow?"
6. **Copy/tone mapping.** Apply to text: which paragraphs read sharp vs warm. An
   editorial/voice tool.
7. **Emotional journey arc.** Across a flow (signup → empty → first success), chart
   the texture arc — a "feelings Wordle" for funnels.
8. **Design-system governance.** Tag components by texture so designers pick
   tone-appropriate parts; a library annotated by felt tone.
9. **Segment/cross-cultural deltas.** Same site, different audiences mark
   differently → reveals where tone lands unevenly.
10. **Teaching tool.** Helps students *articulate* why something feels cold, via a
    structured vocabulary instead of vague "I don't like it."

### Mechanics (reuse P&G primitives)
- **Select a region** (screenshot box / DOM element / Figma layer) → set intensity on
  the **same center-out prickly↔gooey slider**. Optional "why" note (reuses P&G's
  commentary mechanic).
- **Aggregate raters** → average texture per region + **divergence** (where raters
  disagree = the existing "most divisive" view, reused).
- **Output:** a heatmap overlay + the **spectrum plot** (P&G's Section B view) of
  regions.

### Possible shapes
- Browser extension (annotate any live site)
- Bookmarklet / paste-a-URL screenshot annotator
- Figma plugin (tag frames/layers)
- Embeddable widget for moderated research sessions

### Open questions / risks
- Does the prickly/gooey metaphor **transfer** from "judging things" to "judging UI
  regions" without training?
- **Inter-rater reliability** — do people converge enough to be useful?
- Is one bipolar axis enough, or pair it with a second axis (e.g. calm↔intense) so it
  doesn't collapse back onto good/bad? (cf. Osgood semantic differential, raised in the
  last audit)
- Smallest useful pilot: one page, ~5 raters, see if the heatmap is legible.

---

## Other parked ideas
- **Categories to add:** Airlines (queued), Music Genres, Typefaces, Car Brands,
  Cities, Cocktails, Board Games.
- **Rotating weekly theme** — "This week: Radiohead albums / condiments." Album art via
  Wikipedia (`images:true`).
- **Rank-one-artist's-albums** format (e.g. Beatles) as a category shape.
- **In-app spectrum view + center-out intensity voting** — prototyped in `lab.html`;
  graduate into the real app if it feels right. Directly answers the last audit's
  "measure from the middle" (markedness) point.
