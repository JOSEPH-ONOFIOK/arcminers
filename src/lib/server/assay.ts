// The assay:

import { hashString } from "@/lib/shaft/rng";
import { digTag } from "@/lib/shaft/tag";
import { assayTraits, rarityScore, type MinerTraits } from "@/lib/shaft/traits";
import { renderMinerSvg } from "@/lib/shaft/render";
import type { Tier } from "@/lib/shaft/rules";
import { getStore } from "@/lib/store";
import type { Dig, Player } from "@/lib/store/types";

export type Assay = {
  seed: number;
  tag: string;
  traits: MinerTraits;
  rarity: number;
  /** Lit at the deepest tier the run ever held, not the tier it ended on. */
  tier: Tier;
  svg: string;
  digs: number;
  caveIns: number;
  oreBanked: number;
};

/** Canonical, order-dependent, and stable across machines. */
export function assaySeed(player: Player, digs: Dig[]): number {
  const log = digs
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map((dig) => `${dig.seq}:${dig.tier}:${dig.patch ?? "-"}:${dig.ore}:${dig.caveIn ? 1 : 0}`)
    .join(",");
  return hashString(`${player.handle.toLowerCase()}|${player.rig}|${player.startedAt}|${log}`);
}

export async function assayFor(player: Player): Promise<Assay> {
  // The whole log, not a page of it: an assay computed from the most recent
  // twenty digs would change every time somebody dug again.
  const digs = await getStore().digLog(player.handle, 100_000);
  const seed = assaySeed(player, digs);
  const traits = assayTraits(seed, player.rig);

  return {
    seed,
    tag: digTag(seed),
    traits,
    rarity: rarityScore(traits),
    tier: player.deepestTier,
    svg: renderMinerSvg(traits, player.deepestTier, { id: String(seed) }),
    digs: digs.length,
    caveIns: player.caveIns,
    oreBanked: player.oreBanked,
  };
}
