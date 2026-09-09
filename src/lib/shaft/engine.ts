import {
  BANK_COST_PICKS,
  FAULT_PP,
  OPENING_PICKS,
  PATCH_ODDS,
  PICK_CAP_HOURS,
  RIG_RULES,
  SEAM_FLOOR,
  TIER_RULES,
  type Rig,
  type Tier,
  nextTier,
  tierAt,
  tierIndex,
} from "./rules";

const HOUR_MS = 3_600_000;

export type Picks = {
  available: number;
  cap: number;
  // What `picks_spent` must be written back as when picks are spent.
  baseline: number;
  /** Milliseconds until the next pick lands. Zero once capped. */
  nextPickMs: number;
};

// The accrual clock a new run starts on.
export function openingClock(rig: Rig, now: number): number {
  // Rounded: rigs whose rate doesn't divide the hour produce a fractional
  // millisecond, and `players.started_at` is a BIGINT, a float reaches
  // Postgres as "…536.7144" and is rejected outright. The file store swallows
  // it, so this only ever breaks in production.
  return Math.round(now - OPENING_PICKS * (HOUR_MS / RIG_RULES[rig].picksPerHour));
}

export function picks(rig: Rig, startedAt: number, picksSpent: number, now: number): Picks {
  const rate = RIG_RULES[rig].picksPerHour;
  const interval = HOUR_MS / rate;
  const cap = rate * PICK_CAP_HOURS;

  const elapsed = Math.max(0, now - startedAt);
  const earned = Math.floor(elapsed / interval);
  const raw = Math.max(0, earned - picksSpent);
  const available = Math.min(cap, raw);
  const baseline = raw > cap ? earned - cap : picksSpent;

  return {
    available,
    cap,
    baseline,
    nextPickMs: available >= cap ? 0 : interval - (elapsed % interval),
  };
}

/** What `picks_spent` becomes after spending `count`, overflow already dropped. */
export function spend(state: Picks, count: number): number {
  return state.baseline + count;
}

export type Patch = "dead" | "ore" | "fault";

export type DigContext = {
  tier: Tier;
  rig: Rig;
  /** Cave-in points accumulated from fault lines since the last bank. */
  faultPp: number;
  shielded: boolean;
};

export type DigResult = {
  patch: Patch;
  // Ore before the seam has its say.
  ore: number;
  caveIn: boolean;
  /** True when a Warden's shield ate the collapse instead. */
  shieldConsumed: boolean;
  /** The odds this dig actually ran at, so the log can show them. */
  odds: number;
  /** Fault points after this dig. */
  faultPp: number;
};

// How much of a seam is left to give.
export function seamMultiplier(remaining: number, total: number): number {
  if (total <= 0) return SEAM_FLOOR;
  return Math.max(SEAM_FLOOR, Math.min(1, remaining / total));
}

export function caveInChance(tier: Tier, rig: Rig, faultPp: number): number {
  const base = TIER_RULES[tier].caveIn;
  if (base <= 0) return 0;
  return Math.max(0, Math.min(0.9, base * RIG_RULES[rig].caveIn + faultPp));
}

export function descendCost(to: Tier, rig: Rig): number {
  return Math.round(TIER_RULES[to].descendCost * RIG_RULES[rig].descend);
}

// Resolve one dig from three independent rolls.
export function resolveDig(rolls: readonly number[], context: DigContext): DigResult {
  const [patchRoll, richness, roofRoll] = rolls;
  const tier = TIER_RULES[context.tier];

  let patch: Patch = "dead";
  if (patchRoll >= PATCH_ODDS.dead && patchRoll < PATCH_ODDS.dead + PATCH_ODDS.ore) patch = "ore";
  else if (patchRoll >= PATCH_ODDS.dead + PATCH_ODDS.ore) patch = "fault";

  let ore = 0;
  if (patch === "ore") {
    const [low, high] = tier.pocket;
    // The tier's pocket range already carries its yield; the rig multiplier and
    // the seam are what stack on top. Multiplying by TIER_RULES.yield here too
    // would count the tier's advantage twice.
    const raw = low + richness * (high - low);
    ore = Math.max(1, Math.round(raw * RIG_RULES[context.rig].yield));
  }

  const odds = caveInChance(context.tier, context.rig, context.faultPp);
  const collapsed = odds > 0 && roofRoll < odds;

  return {
    patch,
    ore,
    caveIn: collapsed && !context.shielded,
    shieldConsumed: collapsed && context.shielded,
    odds,
    // A fault raises the next roll; anything else leaves the count where it was.
    // Banking is what clears it, which is the decision the loop hangs on.
    faultPp: patch === "fault" ? context.faultPp + FAULT_PP : context.faultPp,
  };
}

export type Position = {
  tier: Tier;
  oreBanked: number;
  oreLoose: number;
  faultPp: number;
};

/** A collapse costs a tier *and* everything not yet banked. */
export function applyCaveIn(position: Position): Position {
  return {
    tier: tierAt(tierIndex(position.tier) - 1),
    oreBanked: position.oreBanked,
    oreLoose: 0,
    faultPp: 0,
  };
}

export type BankResult = { ok: false; reason: string } | { ok: true; position: Position };

export function bank(position: Position, available: number): BankResult {
  if (available < BANK_COST_PICKS) return { ok: false, reason: "Not enough picks to bank." };
  if (position.oreLoose <= 0) return { ok: false, reason: "Nothing loose to bank." };
  return {
    ok: true,
    position: {
      tier: position.tier,
      oreBanked: position.oreBanked + position.oreLoose,
      oreLoose: 0,
      faultPp: 0,
    },
  };
}

export type DescendResult = { ok: false; reason: string } | { ok: true; position: Position; cost: number };

export function descend(position: Position, rig: Rig): DescendResult {
  const target = nextTier(position.tier);
  if (!target) return { ok: false, reason: "Already at the Core. There is nothing under it." };

  const cost = descendCost(target, rig);
  if (position.oreBanked < cost) {
    return { ok: false, reason: `Descending to ${TIER_RULES[target].label} costs ${cost} Ore.` };
  }

  return {
    ok: true,
    cost,
    position: { ...position, tier: target, oreBanked: position.oreBanked - cost },
  };
}
