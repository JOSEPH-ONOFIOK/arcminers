import { NextResponse } from "next/server";
import { SPOTS } from "@/lib/shaft/rules";
import { boardOf, scoreAll, type Competitor } from "@/lib/shaft/score";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// All three boards, scored fresh.
export async function GET() {
  const store = getStore();
  const [roster, entries] = await Promise.all([store.roster(), store.listEntries()]);
  const now = Date.now();

  const byHandle = new Map(entries.map((entry) => [entry.handle.toLowerCase(), entry]));

  const competitors: Competitor[] = roster.map((player) => {
    const entry = byHandle.get(player.handle.toLowerCase());
    return {
      handle: player.handle,
      rig: player.rig,
      board: boardOf(player.rig),
      tier: player.tier,
      depthSecs: Math.max(0, Math.floor((now - player.tierSince) / 1000)),
      oreBanked: player.oreBanked,
      shieldValue: player.shieldValue,
      likes: entry?.likes ?? 0,
      verified: Boolean(entry),
    };
  });

  const boards = scoreAll(competitors);

  return NextResponse.json({
    now,
    entrants: roster.length,
    spotsTaken: await store.countAllowlist(),
    spotsTotal: SPOTS.total,
    boards: Object.fromEntries(
      Object.entries(boards).map(([board, standings]) => [
        board,
        standings.slice(0, 100).map((standing) => ({
          handle: standing.handle,
          rig: standing.rig,
          tier: standing.tier,
          primary: standing.primary,
          standing: standing.standing,
          rank: standing.rank,
          likes: standing.likes,
          verified: standing.verified,
          tag: byHandle.get(standing.handle.toLowerCase())?.digTag ?? null,
        })),
      ]),
    ),
  });
}
