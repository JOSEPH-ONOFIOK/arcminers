# The Proving Shaft

A pre-mint dig for Arc Miners. Pick a rig, work the seam, go as deep as your
nerve holds. At the close your dig log is hashed into the 40x40 miner you assay,
so the artifact is a pure function of how you played.

```bash
npm run dev
npm run build
npm run typecheck
npm run dryrun:engine                  # the whole loop, no server, invariants asserted
npm run db:migrate                     # applies src/lib/store/schema.sql
npx tsx scripts/preview.ts sheet.png   # contact sheet of miners, to look at
```

Next.js 15 (App Router), React 19, TypeScript, Postgres, plain CSS.

## Layout

| Path | What |
| --- | --- |
| `src/lib/shaft/rules.ts` | Every tunable number. Nothing else hardcodes one. |
| `src/lib/shaft/engine.ts` | The rules as pure functions. No storage, no clock. |
| `src/lib/shaft/render.ts` | 40x40 pixel painter, emits SVG. |
| `src/lib/shaft/score.ts` | Board scoring and spot allocation. |
| `src/lib/server/actions.ts` | Every state change, each inside a locked transaction. |
| `src/lib/store/` | Postgres, plus a JSON fallback for development only. |

## Things that will bite you

**Picks accrue against a clock, not a balance.** `started_at` never moves after
enlistment; available picks are derived from it. The cap is enforced by
forfeiting, in `spend()`. Use it on every spend or the cap silently stops
applying.

**Commit and reveal are separate on purpose.** Committing spends the pick and
writes a row with no outcome in it. Reveal resolves from
`sha256(ARC_SEED_SECRET | handle | seq | committed_at)` at least 20 seconds
later. Three rolls come out of that digest, not one: reusing a single number for
the patch, its richness and the roof would correlate them. Reveals are
idempotent, and the dry run asserts it.

Never rotate `ARC_SEED_SECRET` mid window. Every unrevealed dig would resolve to
something other than what it was committed to.

**Every mutation runs inside `withPlayer`**, holding `SELECT ... FOR UPDATE` on
the player row for the whole read, compute, write. Two digs racing on the same
player would otherwise both see the same ore and both spend the same pick.

**Seam depletion and payout happen in one statement**, under `FOR UPDATE`. This
is why `resolveDig` returns raw ore and the seam applies its own multiplier:
computing it in TypeScript from an earlier read is exactly the race that lets two
players take the last of a seam.

**A data-modifying CTE's rows are invisible to the rest of its own statement.**
Every part of a statement reads one snapshot taken before the write, which is why
`like()` computes its count as a delta instead of re-counting.

**The renderer stores palette indices, not colours.** Depth is applied last: the
ramp is tinted toward the tier glow, and lit pixels are drawn twice, once through
a blur and once crisp on top. One pass alone loses either the glow or the pixel
edges. Colours emit as one run-length encoded path each, not 600 rects.

## Constraints, not application code

| Rule | Enforced by |
| --- | --- |
| One spot per wallet | `UNIQUE (lower(wallet))` |
| One spot per handle | `claims.handle_lower` primary key |
| One like per voter per entry | `PRIMARY KEY (entry_handle, voter_id)` |
| One dig per player per sequence | `UNIQUE (handle_lower, seq)` |
| A Warden cannot stack cover | partial `UNIQUE (warden, target) WHERE consumed_by IS NULL` |

## Identity and the gate

A handle is typed, not proven. Entering the shaft sets a cookie and nothing more,
so anyone can start a run under any name. Identity is established at the post
gate instead, which is the only place it matters, because it is the only path
that writes an entry and therefore the only way onto the boards or into a spot.

`/api/verify` calls X's public oEmbed endpoint and checks four things: the post
exists and is public, its author is the handle the run is held against, it tags
the project, and it carries that run's dig tag. The author check is what stops
someone entering as a stranger, and the tag is what stops someone pasting a
stranger's post.

Swapping in real OAuth later means restoring `/api/session` as a token exchange.
Nothing downstream reads anything but the handle in the cookie.

## Environment

| Variable | Without it |
| --- | --- |
| `DATABASE_URL` | JSON file store. Not safe on serverless. |
| `ARC_SEED_SECRET` | A known development string. Outcomes become predictable. |
| `ARC_WINDOW_OPEN` / `ARC_WINDOW_CLOSE` | Always open. |
| `ARC_SKIP_POST_CHECK` | Development only, ignored in production. |

## Before the window opens

- [ ] Set `DATABASE_URL` and apply the schema. Until then every instance writes
      to its own disk and concurrent writers clobber each other.
- [ ] Set `ARC_SEED_SECRET` to something long and random.
- [ ] Move the rate limits in `src/lib/server/limit.ts` to shared storage. They
      are per instance, so the real ceiling is that times the instance count.
- [ ] Decide whether typed handles are enough. A run under a handle you do not
      own cannot clear the gate, but it can squat the name on the boards until
      the window closes. OAuth closes that; so does letting the real owner
      reclaim a handle at the gate.
- [ ] Decide the sybil floor. One run per handle is enforced, one run per human
      is not. If a spot is worth more than the pick rate costs in attention, add
      a wallet snapshot requirement.
- [ ] Likes are deduped by a `localStorage` id plus an IP throttle, which is why
      they are capped at a tenth of a standing.
- [ ] Set `PROJECT_HANDLE` in `src/lib/shaft/tag.ts`.
- [ ] Settle carry over before the contract is finalised. Starting a minted miner
      at the tier its owner proved needs an initial tier parameter and a seedable
      history array per token. Cheap now, impossible later.
