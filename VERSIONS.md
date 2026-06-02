# Version history

A running log of milestone versions of the site, so you can show progress
and roll back to any point. Each version is also a git **tag** (and can be
turned into a GitHub **Release** — see "Publishing a version" below).

| Version | Commit | Date | What changed |
|---|---|---|---|
| `v0.1-baseline` | `115051d` | 2026-05-29 | Original working prototype: Firebase voting, single "Tech Companies" category, drag/tap sorting. |
| `v0.2-error-feedback` | `3794e74` | 2026-05-29 | Added graceful error handling — failures now show a clear on-screen message instead of a silent "Loading…". |
| `v0.3-swipe-redesign` | `2bd16cb` | 2026-05-29 | Full visual redesign (FT salmon + dark mode). Replaced drag-into-buckets with a swipe interaction (right = gooey, left = prickly, up = skip). New absolute-rating data model (`shown`/`gooey`/`prickly`/`skipped`) with least-shown selection (bottom-20% pool) and confidence-aware results. Note: vote counts reset — prior pairwise data is not comparable. |
| `v0.4-glow-shards` | `d426bde` | 2026-06-02 | Shipped the high-fidelity "Glow & Shards" swipe feedback into the live app: layered gooey glow + glassy bubbles (right), faceted shards (left), card environment lighting, quiet word cue, feathered edges, mobile over-card spill. Added billionaires / presidents / alphabet categories + a Vote-screen category switcher. `RANK_MIN_VOTES` restored to 5 for production. |

## How to revert to a previous version

**Look at an old version without changing anything** (you end up "detached";
just `git switch -` to come back):

```bash
git checkout v0.1-baseline
```

**Make the live site match an old version again** (creates a new commit that
restores the old file, keeping full history):

```bash
git checkout main                 # or your live branch
git checkout v0.1-baseline -- index.html
git commit -m "Revert to v0.1-baseline"
git push
```

On GitHub you can also browse any version at:
`https://github.com/jdomsin/Prickles-and-Goo/tree/v0.1-baseline`

## Cutting a new version

When a milestone is ready:

```bash
git add -A
git commit -m "Describe what changed"
git tag -a v0.3-some-name -m "Short summary"
git push && git push --tags
```

Then add a row to the table above.

## Publishing a version as a GitHub Release (optional, nice for showing progress)

Tags pushed from the cloud sandbox may be blocked, so the easiest path is the
GitHub web UI: **Releases → Draft a new release → choose a tag (or type a new
one) → pick the commit → Publish.** Releases give each version a dated,
named page you can link to.
