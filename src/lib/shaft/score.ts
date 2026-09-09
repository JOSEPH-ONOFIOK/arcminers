// Turning three different games into one number.

import { BOARDS, RIG_RULES, SPOTS, tierIndex, type Board, type Tier } from "./rules";
import { createRng } from "./rng";

export type Competitor = {
  handle: string;
  rig: string;
  board: Board;
  tier: Tier;
  /** Seconds held, unbroken, at the current tier. */
  depthSecs: number;
  oreBanked: number;
  shieldValue: number;
  likes: number;
  /** Whether the post gate has been cleared. No gate, no spot. */
  verified: boolean;
};

export type Standing = Competitor & {
  /** The board's own measure: ore, weighted depth, or shield value. */
  primary: number;
  standing: number;
  rank: number;
};

// Weighted depth:
export function weightedDepth(tier: Tier, depthSecs: number): number {
  return tierIndex(tier) * 1_000_000 + Math.min(depthSecs, 999_999);
}

function primaryOf(competitor: Competitor): number {
  switch (competitor.board) {
    case "richest":
      return competitor.oreBanked;
    case "deepest":
      return weightedDepth(competitor.tier, competitor.depthSecs);
    case "watch":
      return competitor.shieldValue;
  }
}

function normalise(value: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
}

// Score one board.
export function scoreBoard(competitors: Competitor[]): Standing[] {
  const withPrimary = competitors.map((competitor) => ({
    ...competitor,
    primary: primaryOf(competitor),
  }));

  const primaryMax = Math.max(0, ...withPrimary.map((c) => c.primary));
  const depthMax = Math.max(0, ...withPrimary.map((c) => c.depthSecs));
  const likesMax = Math.max(0, ...withPrimary.map((c) => c.likes));
  const likeScale = Math.log2(1 + likesMax);

  return withPrimary
    .map((competitor) => ({
      ...competitor,
      standing:
        Math.round(
          (550 * normalise(competitor.primary, primaryMax) +
            350 * normalise(competitor.depthSecs, depthMax) +
            100 * (likeScale > 0 ? Math.log2(1 + competitor.likes) / likeScale : 0)) *
            10,
        ) / 10,
    }))
    .sort((a, b) => b.standing - a.standing || b.primary - a.primary || a.handle.localeCompare(b.handle))
    .map((competitor, index) => ({ ...competitor, rank: index + 1 }));
}

export function boardOf(rig: string): Board {
  return RIG_RULES[rig as keyof typeof RIG_RULES]?.board ?? "richest";
}

export function scoreAll(competitors: Competitor[]): Record<Board, Standing[]> {
  const out = {} as Record<Board, Standing[]>;
  for (const board of BOARDS) {
    out[board] = scoreBoard(competitors.filter((competitor) => competitor.board === board));
  }
  return out;
}

export type Allocation = {
  handle: string;
  board: Board | "lottery";
  rank: number;
  standing: number;
};

// Hand out the thousand spots.
export function allocate(boards: Record<Board, Standing[]>, seed: number): Allocation[] {
  const spots: Allocation[] = [];
  const claimed = new Set<string>();

  for (const board of BOARDS) {
    const cap = SPOTS[board];
    for (const standing of boards[board]) {
      if (spots.filter((spot) => spot.board === board).length >= cap) break;
      if (!standing.verified || claimed.has(standing.handle)) continue;
      claimed.add(standing.handle);
      spots.push({ handle: standing.handle, board, rank: standing.rank, standing: standing.standing });
    }
  }

  const pool = BOARDS.flatMap((board) => boards[board]).filter(
    (standing) => standing.verified && !claimed.has(standing.handle) && standing.oreBanked > 0,
  );

  const rng = createRng(seed);
  let remaining = [...pool];
  let weight = remaining.reduce((sum, standing) => sum + Math.max(1, standing.standing), 0);

  while (spots.length < SPOTS.total && remaining.length > 0) {
    let cursor = rng.next() * weight;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      cursor -= Math.max(1, remaining[i].standing);
      if (cursor <= 0) {
        index = i;
        break;
      }
    }
    const winner = remaining[index];
    spots.push({
      handle: winner.handle,
      board: "lottery",
      rank: spots.length + 1,
      standing: winner.standing,
    });
    // Drawn without replacement, so one entrant cannot win twice.
    weight -= Math.max(1, winner.standing);
    remaining = remaining.filter((_, i) => i !== index);
  }

  return spots;
}
