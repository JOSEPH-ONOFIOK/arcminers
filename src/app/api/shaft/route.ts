import { NextResponse } from "next/server";
import { caveInChance, descendCost, picks as pickState } from "@/lib/shaft/engine";
import { SPOTS, nextTier } from "@/lib/shaft/rules";
import type { ShaftState } from "@/lib/shaft/state";
import { getStore } from "@/lib/store";
import { currentHandle, devSignInAllowed, signInConfigured } from "@/lib/server/session";
import { dayKey, windowBounds, windowState } from "@/lib/server/window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Everything the shaft page needs, in one request.
export async function GET() {
  const now = Date.now();
  const handle = await currentHandle();
  const store = getStore();
  const bounds = windowBounds();

  const base: ShaftState = {
    now,
    handle,
    configured: signInConfigured(),
    devSignIn: devSignInAllowed(),
    window: { state: windowState(now), open: bounds.open, close: bounds.close },
    player: null,
    picks: null,
    pending: null,
    seams: await store.seams(dayKey(now)),
    log: [],
    cover: [],
    placed: [],
    entry: null,
    claim: null,
    spotsTaken: await store.countAllowlist(),
  };

  if (!handle) return NextResponse.json(base);

  const player = await store.getPlayer(handle);
  if (!player) return NextResponse.json(base);

  const log = await store.digLog(handle, 30);
  const state = pickState(player.rig, player.startedAt, player.picksSpent, now);
  const below = nextTier(player.tier);
  const [cover, placed, entry, claim] = await Promise.all([
    store.shieldsFor(handle, now),
    store.wardenShields(handle),
    store.getEntry(handle),
    store.getClaim(handle),
  ]);

  // A dig committed but never revealed, a closed tab, a dropped connection.
  // It is resumable rather than lost: the pick was already spent for it.
  const pending = log.find((dig) => dig.revealedAt === null) ?? null;

  return NextResponse.json({
    ...base,
    player: {
      handle: player.handle,
      rig: player.rig,
      tier: player.tier,
      tierSince: player.tierSince,
      deepestTier: player.deepestTier,
      oreBanked: player.oreBanked,
      oreLoose: player.oreLoose,
      faultPp: player.faultPp,
      digs: player.digs,
      caveIns: player.caveIns,
      saved: player.saved,
      shieldValue: player.shieldValue,
      odds: caveInChance(player.tier, player.rig, player.faultPp),
      descendCost: below ? descendCost(below, player.rig) : null,
      nextTier: below,
    },
    picks: { available: state.available, cap: state.cap, nextPickMs: state.nextPickMs },
    pending: pending
      ? { id: pending.id, revealAt: pending.revealAt, tier: pending.tier, odds: pending.odds }
      : null,
    log: log.map((dig) => ({
      id: dig.id,
      seq: dig.seq,
      tier: dig.tier,
      patch: dig.patch,
      ore: dig.ore,
      caveIn: dig.caveIn,
      shielded: dig.shielded,
      odds: dig.odds,
      revealedAt: dig.revealedAt,
      revealAt: dig.revealAt,
    })),
    cover: cover.map((shield) => ({ warden: shield.warden, expiresAt: shield.expiresAt })),
    placed: placed.map((shield) => ({
      target: shield.target,
      expiresAt: shield.expiresAt,
      consumed: Boolean(shield.consumedBy),
    })),
    entry: entry ? { tag: entry.digTag, likes: entry.likes, verifiedAt: entry.verifiedAt } : null,
    claim: claim ? { sigil: claim.sigil, position: claim.position } : null,
    spotsTaken: base.spotsTaken,
    spotsTotal: SPOTS.total,
  });
}
