// The shape the client sees.

import type { Patch } from "./engine";
import type { Board, Rig, Tier } from "./rules";
import type { MinerTraits } from "./traits";

export type WindowView = { state: "before" | "open" | "closed"; open: number | null; close: number | null };

export type PlayerView = {
  handle: string;
  rig: Rig;
  tier: Tier;
  tierSince: number;
  deepestTier: Tier;
  oreBanked: number;
  oreLoose: number;
  faultPp: number;
  digs: number;
  caveIns: number;
  saved: number;
  shieldValue: number;
  /** The odds the next dig at this tier will run at, fault included. */
  odds: number;
  /** What the next descent costs this rig, or null at the Core. */
  descendCost: number | null;
  nextTier: Tier | null;
};

export type DigView = {
  id: string;
  seq: number;
  tier: Tier;
  patch: Patch | null;
  ore: number;
  caveIn: boolean;
  shielded: boolean;
  odds: number;
  revealedAt: number | null;
  revealAt: number;
};

export type SeamView = { tier: Tier; remaining: number; total: number };

export type ShaftState = {
  now: number;
  handle: string | null;
  configured: boolean;
  devSignIn: boolean;
  window: WindowView;
  player: PlayerView | null;
  picks: { available: number; cap: number; nextPickMs: number } | null;
  /** A committed dig still waiting on its reveal, so a refresh resumes it. */
  pending: { id: string; revealAt: number; tier: Tier; odds: number } | null;
  seams: SeamView[];
  log: DigView[];
  cover: { warden: string; expiresAt: number }[];
  placed: { target: string; expiresAt: number; consumed: boolean }[];
  entry: { tag: string; likes: number; verifiedAt: number } | null;
  claim: { sigil: string; position: number } | null;
  spotsTaken: number;
};

export type AssayView = {
  seed: number;
  tag: string;
  traits: MinerTraits;
  traitList: { label: string; value: string }[];
  rarity: number;
  tier: Tier;
  svg: string;
  digs: number;
  caveIns: number;
  oreBanked: number;
  postText: string;
  intentUrl: string;
};

export type StandingView = {
  handle: string;
  rig: Rig;
  tier: Tier;
  primary: number;
  standing: number;
  rank: number;
  likes: number;
  verified: boolean;
  tag: string | null;
};

export type BoardsView = {
  now: number;
  boards: Record<Board, StandingView[]>;
  entrants: number;
  spotsTaken: number;
};
