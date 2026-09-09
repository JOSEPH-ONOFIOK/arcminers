import type { Patch } from "@/lib/shaft/engine";
import type { Rig, Tier } from "@/lib/shaft/rules";
import type { MinerTraits } from "@/lib/shaft/traits";

export type Player = {
  /** Display casing. Identity is `lower(handle)` everywhere it matters. */
  handle: string;
  rig: Rig;
  /** The one clock picks accrue against. Never moves. */
  startedAt: number;
  picksSpent: number;
  tier: Tier;
  /** When the player arrived at the current tier, the Deepest tiebreak. */
  tierSince: number;
  /** High-water mark, kept even after a collapse takes the tier away. */
  deepestTier: Tier;
  oreBanked: number;
  oreLoose: number;
  faultPp: number;
  digs: number;
  caveIns: number;
  /** Collapses a Warden's shield ate for this player. */
  saved: number;
  /** A Warden's score: tiers protected, weighted by how deep they were. */
  shieldValue: number;
};

export type Dig = {
  id: string;
  handle: string;
  seq: number;
  tier: Tier;
  committedAt: number;
  revealAt: number;
  revealedAt: number | null;
  patch: Patch | null;
  ore: number;
  caveIn: boolean;
  shielded: boolean;
  odds: number;
};

export type Shield = {
  id: string;
  warden: string;
  target: string;
  placedAt: number;
  expiresAt: number;
  consumedBy: string | null;
};

export type Entry = {
  handle: string;
  digTag: string;
  seed: number;
  rig: Rig;
  tier: Tier;
  traits: MinerTraits;
  rarity: number;
  postId: string;
  verifiedAt: number;
  likes: number;
};

export type Claim = {
  handle: string;
  wallet: string;
  sigil: string;
  position: number;
  joinedAt: number;
};

export type JoinResult =
  | { ok: true; claim: Claim }
  /** Which field already holds a spot, so the form can say which one to change. */
  | { ok: false; taken: "wallet" | "handle" | "full" };

export type SeamState = { tier: Tier; remaining: number; total: number };

// A player's row, held under lock, plus the writes that have to land with it.
export interface Tx {
  player: Player;
  savePlayer(next: Player): Promise<void>;
  insertDig(dig: Dig): Promise<void>;
  getDig(id: string): Promise<Dig | null>;
  updateDig(dig: Dig): Promise<void>;
  // Take ore out of a seam, applying its depletion multiplier, in one statement.
  takeSeam(day: string, tier: Tier, rawOre: number): Promise<{ granted: number; multiplier: number }>;
  /** The oldest unconsumed shield covering this player, if any. */
  activeShield(target: string, now: number): Promise<Shield | null>;
  consumeShield(id: string, digId: string, value: number): Promise<void>;
  insertShield(shield: Shield): Promise<void>;
}

export interface ShaftStore {
  getPlayer(handle: string): Promise<Player | null>;
  // Idempotent.
  enlist(handle: string, rig: Rig, now: number, startedAt: number): Promise<Player>;
  /** Run a mutation against a locked player row. */
  withPlayer<T>(handle: string, run: (tx: Tx) => Promise<T>): Promise<T>;

  digLog(handle: string, limit: number): Promise<Dig[]>;
  seams(day: string): Promise<SeamState[]>;
  /** Every player, for scoring. Small by construction, one row per entrant. */
  roster(): Promise<Player[]>;
  shieldsFor(target: string, now: number): Promise<Shield[]>;
  wardenShields(warden: string): Promise<Shield[]>;

  saveEntry(entry: Omit<Entry, "likes">): Promise<Entry>;
  getEntry(handle: string): Promise<Entry | null>;
  listEntries(): Promise<Entry[]>;
  like(handle: string, voterId: string): Promise<{ likes: number; liked: boolean } | null>;
  likedBy(voterId: string): Promise<string[]>;

  joinAllowlist(handle: string, wallet: string, sigil: string): Promise<JoinResult>;
  getClaim(handle: string): Promise<Claim | null>;
  countAllowlist(): Promise<number>;
}
