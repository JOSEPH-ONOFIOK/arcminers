// Every tunable number in the Proving Shaft, in one place.

export const TIERS = ["surface", "cave", "deep", "core"] as const;
export type Tier = (typeof TIERS)[number];

export type TierRule = {
  label: string;
  /** Multiplier on the base ore pocket. */
  yield: number;
  /** Ore per pocket at this tier, before rig and seam multipliers. */
  pocket: readonly [number, number];
  /** Ore to descend *into* this tier. */
  descendCost: number;
  /** Probability of a cave-in per dig, before rig multiplier and fault. */
  caveIn: number;
  /** Ore the whole field shares at this tier, per UTC day. */
  dailyPool: number;
  /** Glow applied to the miner's lit pixels at this tier. */
  glow: string;
  glowStrength: number;
};

export const TIER_RULES: Record<Tier, TierRule> = {
  surface: {
    label: "Surface",
    yield: 1,
    pocket: [8, 14],
    descendCost: 0,
    caveIn: 0,
    dailyPool: 1_000_000,
    glow: "#8a8175",
    glowStrength: 0,
  },
  cave: {
    label: "Cave",
    yield: 1.75,
    pocket: [16, 26],
    descendCost: 120,
    caveIn: 0.03,
    dailyPool: 600_000,
    glow: "#8fb8d6",
    glowStrength: 0.45,
  },
  deep: {
    label: "Deep Cave",
    yield: 3,
    pocket: [30, 48],
    descendCost: 420,
    caveIn: 0.08,
    dailyPool: 300_000,
    glow: "#e08a3c",
    glowStrength: 0.75,
  },
  core: {
    label: "Core",
    yield: 5.25,
    pocket: [58, 92],
    descendCost: 1400,
    caveIn: 0.15,
    dailyPool: 120_000,
    glow: "#ffc44a",
    glowStrength: 1,
  },
};

export const RIGS = ["prospector", "driller", "blaster", "warden"] as const;
export type Rig = (typeof RIGS)[number];

export type RigRule = {
  label: string;
  yield: number;
  descend: number;
  caveIn: number;
  picksPerHour: number;
  /** Which board this rig is scored on. */
  board: Board;
  blurb: string;
};

export const RIG_RULES: Record<Rig, RigRule> = {
  prospector: {
    label: "Prospector",
    yield: 1,
    descend: 1,
    caveIn: 1,
    picksPerHour: 6,
    board: "richest",
    blurb: "The baseline. Steady, wins on volume.",
  },
  driller: {
    label: "Driller",
    yield: 1.35,
    descend: 1.5,
    caveIn: 0.9,
    picksPerHour: 5,
    board: "richest",
    blurb: "Rich but slow to move. Grinds a tier and holds it.",
  },
  blaster: {
    label: "Blaster",
    yield: 1.15,
    descend: 0.6,
    caveIn: 1.6,
    picksPerHour: 7,
    board: "deepest",
    blurb: "Cheap descents, brutal odds. Boom or crater.",
  },
  warden: {
    label: "Warden",
    yield: 0.4,
    descend: 1.2,
    caveIn: 0.5,
    picksPerHour: 6,
    board: "watch",
    blurb: "Barely mines. Spends picks shielding other people.",
  },
};

export const BOARDS = ["richest", "deepest", "watch"] as const;
export type Board = (typeof BOARDS)[number];

export const BOARD_LABELS: Record<Board, string> = {
  richest: "Richest",
  deepest: "Deepest",
  watch: "The Watch",
};

/** Picks bank for six hours before the overflow is lost. */
export const PICK_CAP_HOURS = 6;

// Picks in hand at enlistment.
export const OPENING_PICKS = 6;

/** Per dig, at any tier. A fault pays nothing and raises the next roll. */
export const PATCH_ODDS = { dead: 0.52, ore: 0.43, fault: 0.05 } as const;

/** What one fault line adds to cave-in odds, until the next bank clears it. */
export const FAULT_PP = 0.02;

/** A drained seam still pays this fraction, so a late arrival isn't digging rock. */
export const SEAM_FLOOR = 0.25;

/** Banking costs a pick, which is what makes hoarding loose ore a real bet. */
export const BANK_COST_PICKS = 1;

export const SHIELD_COST_PICKS = 3;
export const SHIELD_HOURS = 6;

// The gap between committing to a dig and learning the outcome.
export const REVEAL_DELAY_MS = 20_000;

/** Spots on the line, and how they are handed out. */
export const SPOTS = {
  total: 1000,
  richest: 250,
  deepest: 250,
  watch: 80,
  lottery: 420,
} as const;

export const ALLOWLIST_OPEN = true;

/** EVM address, as minted on Arc. */
export const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
export const HANDLE_RE = /^@?[A-Za-z0-9_]{1,15}$/;

export function tierIndex(tier: Tier): number {
  return TIERS.indexOf(tier);
}

export function tierAt(index: number): Tier {
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, index))];
}

export function deeperThan(a: Tier, b: Tier): boolean {
  return tierIndex(a) > tierIndex(b);
}

/** The tier below this one, or null at the Core. */
export function nextTier(tier: Tier): Tier | null {
  const index = tierIndex(tier);
  return index >= TIERS.length - 1 ? null : TIERS[index + 1];
}

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "");
}
