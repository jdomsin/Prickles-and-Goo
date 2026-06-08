# Migration plan: binary verdict → signed intensity

**Goal.** Let a vote carry *how much*, not just *which way* — a signed intensity in
`[-100, +100]` (prickly negative, gooey positive, 0 = neutral). This is what makes the
swipe-with-force interaction and the prickly→gooey spectrum real, and it delivers the
last audit's "measure from the middle" (markedness) fix at the data layer.

Designed to be **additive and non-destructive**: nothing that exists today breaks, old
data keeps working, and the spectrum gets richer as intensity votes accumulate.

---

## 1. Where verdict lives today

- **Item doc** `categories/{cat}/items/{id}`: `{ name, shown, gooey, prickly, skipped }`
  — counters; a vote does `shown +1` and exactly one of `gooey|prickly|skipped +1`.
- **Firestore rules**: `isSingleVote()` validates that single-+1 shape; item create/delete denied.
- **Reasons**: `reasons_gooey` / `reasons_prickly` subcollections.
- **Client**: `commitVote(item, verdict, cat)`; localStorage `pg-voted-<cat>`: `id → 'gooey'|'prickly'|'skip'`.
- **Reads that assume binary**: results `gp = gooey/(gooey+prickly)`; the OG cards;
  the taste profile; the daily recap + result string.

## 2. Recommended shape: additive aggregates (Option B)

Keep `gooey/prickly/skipped/shown` exactly as they are, and **add** three fields:

| field    | meaning                              | use |
|----------|--------------------------------------|-----|
| `iVotes` | count of intensity-bearing votes     | denominator |
| `iSum`   | Σ signed intensity                   | **mean** position on the spectrum = `iSum/iVotes` |
| `iSumSq` | Σ intensity²                         | **variance** → divisiveness (std-dev), without a histogram |

- **Mean intensity** `m = iSum/iVotes` → spectrum x-position; `gp_intensity = 50 + m/2`.
- **Divisiveness** `var = iSumSq/iVotes − m²` → std-dev. High var = genuinely split
  (bimodal), distinct from "mean near 50". This is a *better* divisive signal than the
  current distance-from-50 heuristic.
- O(1) read, no per-vote docs, no fan-out.

Why not the alternatives:
- *Per-vote documents* (votes subcollection): full distribution + per-user, but expensive
  reads, needs aggregation, larger abuse surface. Overkill now.
- *7-bucket histogram*: nice for showing distribution *shape*; can be added later as
  `b0..b6` counters (each a clean +1, rule-friendly) if mean+variance prove insufficient.

## 3. Write path

`commitVote(item, signed /* -100..100 */, cat)`:

```
verdict = signed > 8 ? 'gooey' : signed < -8 ? 'prickly' : 'skip';   // for legacy counters + reason routing
update = { shown: +1, [verdict]: +1 }            // unchanged legacy counters
if (verdict !== 'skip') {                         // intensity only on real calls
    update.iVotes = +1;
    update.iSum   += signed;
    update.iSumSq += signed*signed;
}
```

- **Old binary swipe** (if kept anywhere) writes `signed = ±100` → behaves like today.
- **Skip** stays a skip; no intensity recorded.

## 4. Firestore rules

Extend `isSingleVote()` to additionally permit the three intensity fields *together*,
sign-consistent with the gooey/prickly bump and range-bounded:

```
// in addition to the existing shown+1 and one-of gooey/prickly/skipped +1:
let dSum = r.get('iSum',0)   - o.get('iSum',0);
let dCnt = r.get('iVotes',0) - o.get('iVotes',0);
let dSq  = r.get('iSumSq',0) - o.get('iSumSq',0);
// either no intensity change (legacy/skip) OR a single bounded, sign-consistent one:
(dCnt == 0 && dSum == 0 && dSq == 0)
|| ( dCnt == 1
     && dSum >= -100 && dSum <= 100
     && dSq == dSum*dSum
     && ((dSum > 0) == (gooey bumped)) && ((dSum < 0) == (prickly bumped)) )
```

Trade-off vs today: `iSum`'s delta is **range-checked**, not pinned to an exact value, so
a malicious client can bias by up to ±100 per write — the same per-vote-magnitude exposure
the project already documents (anonymous rate-limiting needs App Check). `dSq == dSum*dSum`
keeps `iSumSq` honest, so variance can't be poisoned independently.

## 5. Client + reads

- `commitVote` signature gains `signed`; the swipe interaction supplies it; a fallback
  binary path passes ±100.
- localStorage: add `pg-intensity-<cat>`: `id → signed` (keep `pg-voted-<cat>` for compat).
- **Spectrum view**: x = `iVotes ? 50 + (iSum/iVotes)/2 : gp` (fall back to today's % until
  intensity data exists). Dot spread/lane by that x; divisiveness from std-dev.
- **Taste profile**: use *your* mean intensity for "you lean", and plot your calls on the
  same axis; archetypes can key off magnitude (very-gooey vs barely-gooey).
- **Reveal / recap / OG / result string**: keep reading `gp` (unchanged) — they work
  through the whole migration; opt them into intensity later if desired.

## 6. Rollout (no big-bang)

1. **Add fields + rules** (additive; old writes still valid). Deploy rules first.
2. **Dual-write**: ship the swipe-intensity interaction writing both legacy counters and
   the three aggregates.
3. **Read-prefer-intensity**: where `iVotes >= MIN` use the mean; else fall back to `gp`.
   So the spectrum is correct from day one and sharpens over time.
4. Optional later: 7-bucket histogram for distribution shape; intensity in the OG cards
   and the Wordle result row.

## 7. Risks / watch-items

- **Mean vs bar %.** `gp` (over all binary votes) and `iSum/iVotes` (over intensity votes)
  can diverge while both populations differ. Prefer one as canonical per surface; document it.
- **Rule integrity** is per-field bounded, not exact (see §4). Acceptable given the existing
  rate-limit caveat; App Check closes it.
- **Cold start.** Until `iVotes` builds up, spectrum positions come from `gp`. Use `MIN_INTENSITY_VOTES` like the existing `RANK_MIN_VOTES`.
- **Don't migrate historical binary votes into intensity** — they have no magnitude. Let
  intensity accrue from new votes; the two coexist.

## 8. What it unlocks

Real spectrum view · center-out input as the primary gesture · "measure from the middle"
default · variance-based divisiveness · magnitude-aware archetypes — all without breaking
a single thing already shipped.
