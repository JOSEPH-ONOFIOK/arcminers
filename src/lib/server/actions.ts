// Every state change in the shaft.

import { randomUUID } from "node:crypto";
import {
  applyCaveIn,
  bank as bankPosition,
  caveInChance,
  descend as descendPosition,
  openingClock,
  picks as pickState,
  resolveDig,
  spend,
} from "@/lib/shaft/engine";
import { digitsFrom } from "@/lib/shaft/rng";
import {
  BANK_COST_PICKS,
  REVEAL_DELAY_MS,
  SHIELD_COST_PICKS,
  SHIELD_HOURS,
  TIER_RULES,
  deeperThan,
  tierIndex,
  type Rig,
} from "@/lib/shaft/rules";
import { getStore } from "@/lib/store";
import type { Dig, Player } from "@/lib/store/types";
import { dayKey, digDigest, windowState } from "./window";

export type Fail = { ok: false; reason: string; retryAfterMs?: number };
export type Ok<T> = { ok: true } & T;
export type Result<T> = Ok<T> | Fail;

function fail(reason: string, retryAfterMs?: number): Fail {
  return { ok: false, reason, retryAfterMs };
}

function guardWindow(now: number): Fail | null {
  const state = windowState(now);
  if (state === "before") return fail("The shaft isn't open yet.");
  if (state === "closed") return fail("The window has closed. Assay your run instead.");
  return null;
}

/** Enlist, locking the rig for the whole run. */
export async function enlist(handle: string, rig: Rig, now = Date.now()): Promise<Result<{ player: Player }>> {
  const closed = guardWindow(now);
  if (closed) return closed;
  // The accrual clock is backdated so the run opens with picks in hand; the
  // depth timer still starts now.
  const player = await getStore().enlist(handle, rig, now, openingClock(rig, now));
  return { ok: true, player };
}

// Commit to a dig.
export async function commitDig(handle: string, now = Date.now()): Promise<Result<{ dig: Dig }>> {
  const closed = guardWindow(now);
  if (closed) return closed;

  return getStore().withPlayer(handle, async (tx) => {
    const player = tx.player;
    const state = pickState(player.rig, player.startedAt, player.picksSpent, now);
    if (state.available < 1) {
      return fail("No picks. They accrue on the clock, come back shortly.", state.nextPickMs);
    }

    const seq = player.digs + 1;
    const dig: Dig = {
      id: `${handle.toLowerCase()}-${seq}`,
      handle,
      seq,
      tier: player.tier,
      committedAt: now,
      revealAt: now + REVEAL_DELAY_MS,
      revealedAt: null,
      patch: null,
      ore: 0,
      caveIn: false,
      shielded: false,
      // Recorded at commit, not at reveal: the odds a player agreed to are the
      // odds shown when they agreed, even if a fault changes them afterwards.
      odds: caveInChance(player.tier, player.rig, player.faultPp),
    };

    await tx.insertDig(dig);
    await tx.savePlayer({ ...player, picksSpent: spend(state, 1), digs: seq });
    return { ok: true as const, dig };
  });
}

export type RevealOutcome = {
  dig: Dig;
  player: Player;
  /** How much the seam's depletion cut the payout, for the log. */
  seamMultiplier: number;
};

// Resolve a committed dig.
export async function revealDig(
  handle: string,
  digId: string,
  now = Date.now(),
): Promise<Result<RevealOutcome>> {
  return getStore().withPlayer(handle, async (tx) => {
    const existing = await tx.getDig(digId);
    if (!existing) return fail("No such dig.");
    if (existing.revealedAt !== null) {
      return { ok: true as const, dig: existing, player: tx.player, seamMultiplier: 1 };
    }
    if (now < existing.revealAt) {
      return fail("The dust hasn't settled yet.", existing.revealAt - now);
    }

    const player = tx.player;
    const digest = digDigest(handle, existing.seq, existing.committedAt);
    const rolls = digitsFrom(digest, 3);

    // Only tiers that can collapse bother looking for cover, so a Surface dig
    // never burns a Warden's shield on a roll it was never going to lose.
    const shield =
      TIER_RULES[existing.tier].caveIn > 0 ? await tx.activeShield(handle, now) : null;

    const result = resolveDig(rolls, {
      tier: existing.tier,
      rig: player.rig,
      faultPp: player.faultPp,
      shielded: Boolean(shield),
    });

    let granted = 0;
    let multiplier = 1;
    if (result.patch === "ore" && result.ore > 0) {
      const taken = await tx.takeSeam(dayKey(now), existing.tier, result.ore);
      granted = taken.granted;
      multiplier = taken.multiplier;
    }

    let next: Player = {
      ...player,
      oreLoose: player.oreLoose + granted,
      faultPp: result.faultPp,
    };

    if (result.shieldConsumed && shield) {
      // A shield is worth what it saved: deeper collapses are worth more.
      await tx.consumeShield(shield.id, existing.id, tierIndex(existing.tier) * 100);
      next = { ...next, saved: next.saved + 1 };
    }

    if (result.caveIn) {
      const after = applyCaveIn({
        tier: next.tier,
        oreBanked: next.oreBanked,
        oreLoose: next.oreLoose,
        faultPp: next.faultPp,
      });
      next = {
        ...next,
        tier: after.tier,
        oreLoose: after.oreLoose,
        faultPp: after.faultPp,
        tierSince: now,
        caveIns: next.caveIns + 1,
      };
    }

    const dig: Dig = {
      ...existing,
      revealedAt: now,
      patch: result.patch,
      ore: granted,
      caveIn: result.caveIn,
      shielded: result.shieldConsumed,
      odds: result.odds,
    };

    await tx.updateDig(dig);
    await tx.savePlayer(next);
    return { ok: true as const, dig, player: next, seamMultiplier: multiplier };
  });
}

/** Move loose ore somewhere a cave-in can't reach, and clear the fault count. */
export async function bank(handle: string, now = Date.now()): Promise<Result<{ player: Player; banked: number }>> {
  const closed = guardWindow(now);
  if (closed) return closed;

  return getStore().withPlayer(handle, async (tx) => {
    const player = tx.player;
    const state = pickState(player.rig, player.startedAt, player.picksSpent, now);
    const result = bankPosition(
      { tier: player.tier, oreBanked: player.oreBanked, oreLoose: player.oreLoose, faultPp: player.faultPp },
      state.available,
    );
    if (!result.ok) return fail(result.reason, state.nextPickMs);

    const banked = player.oreLoose;
    const next: Player = {
      ...player,
      oreBanked: result.position.oreBanked,
      oreLoose: 0,
      faultPp: 0,
      picksSpent: spend(state, BANK_COST_PICKS),
    };
    await tx.savePlayer(next);
    return { ok: true as const, player: next, banked };
  });
}

export async function descend(handle: string, now = Date.now()): Promise<Result<{ player: Player; cost: number }>> {
  const closed = guardWindow(now);
  if (closed) return closed;

  return getStore().withPlayer(handle, async (tx) => {
    const player = tx.player;
    const result = descendPosition(
      { tier: player.tier, oreBanked: player.oreBanked, oreLoose: player.oreLoose, faultPp: player.faultPp },
      player.rig,
    );
    if (!result.ok) return fail(result.reason);

    const next: Player = {
      ...player,
      tier: result.position.tier,
      oreBanked: result.position.oreBanked,
      tierSince: now,
      // The high-water mark survives a collapse: the log remembers how deep
      // someone actually got, even after the roof took it back.
      deepestTier: deeperThan(result.position.tier, player.deepestTier)
        ? result.position.tier
        : player.deepestTier,
    };
    await tx.savePlayer(next);
    return { ok: true as const, player: next, cost: result.cost };
  });
}

// A Warden covers somebody else.
export async function placeShield(
  warden: string,
  target: string,
  now = Date.now(),
): Promise<Result<{ expiresAt: number }>> {
  const closed = guardWindow(now);
  if (closed) return closed;

  if (warden.toLowerCase() === target.toLowerCase()) {
    return fail("A Warden can't shield themselves.");
  }

  const store = getStore();
  const covered = await store.getPlayer(target);
  if (!covered) return fail("Nobody by that handle is down the shaft.");

  const live = await store.shieldsFor(target, now);
  if (live.some((shield) => shield.warden === warden.toLowerCase())) {
    return fail("You already have a shield on them. One cover at a time.");
  }

  return store.withPlayer(warden, async (tx) => {
    const player = tx.player;
    if (player.rig !== "warden") return fail("Only Wardens can place shields.");

    const state = pickState(player.rig, player.startedAt, player.picksSpent, now);
    if (state.available < SHIELD_COST_PICKS) {
      return fail(`A shield costs ${SHIELD_COST_PICKS} picks.`, state.nextPickMs);
    }

    const expiresAt = now + SHIELD_HOURS * 3_600_000;
    try {
      await tx.insertShield({
        id: randomUUID(),
        warden,
        target,
        placedAt: now,
        expiresAt,
        consumedBy: null,
      });
    } catch {
      // The partial unique index is the real guard against stacking; the check
      // above only makes the common case a clean message instead of a 500.
      return fail("You already have a shield on them. One cover at a time.");
    }

    await tx.savePlayer({ ...player, picksSpent: spend(state, SHIELD_COST_PICKS) });
    return { ok: true as const, expiresAt };
  });
}
