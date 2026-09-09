import { RIGS, type Rig } from "./rules";
import { createRng } from "./rng";

export type Option = { name: string; weight: number };
export type Category = { key: string; label: string; options: Option[] };

// How often each type is minted.
export const RIG_WEIGHT: Record<Rig, number> = {
  prospector: 40,
  driller: 30,
  blaster: 22,
  warden: 8,
};

/** Four options per category, four categories per type. Weights sum to 100. */
export const TRAIT_POOLS: Record<Rig, Category[]> = {
  prospector: [
    {
      key: "headgear",
      label: "Headgear",
      options: [
        { name: "Cloth Cap", weight: 40 },
        { name: "Miner's Hat", weight: 30 },
        { name: "Bare Head", weight: 20 },
        { name: "Bandana", weight: 10 },
      ],
    },
    {
      key: "light",
      label: "Light Source",
      options: [
        { name: "Candle", weight: 35 },
        { name: "Single Lamp", weight: 30 },
        { name: "No Light", weight: 25 },
        { name: "Dual Lamp", weight: 10 },
      ],
    },
    {
      key: "tool",
      label: "Tool",
      options: [
        { name: "Pickaxe", weight: 42 },
        { name: "Pan", weight: 28 },
        { name: "Rope", weight: 20 },
        { name: "Empty Hands", weight: 10 },
      ],
    },
    {
      key: "face",
      label: "Eyes/Face",
      options: [
        { name: "Squint", weight: 38 },
        { name: "Wide-Eyed", weight: 30 },
        { name: "Dust Mask", weight: 24 },
        { name: "Clean Face", weight: 8 },
      ],
    },
  ],
  driller: [
    {
      key: "rigtype",
      label: "Rig Type",
      options: [
        { name: "Hand Drill", weight: 40 },
        { name: "Mounted Drill", weight: 30 },
        { name: "Twin Drill", weight: 20 },
        { name: "Jackhammer", weight: 10 },
      ],
    },
    {
      key: "frame",
      label: "Frame",
      options: [
        { name: "Bare Frame", weight: 35 },
        { name: "Patched Frame", weight: 30 },
        { name: "Reinforced Plating", weight: 25 },
        { name: "Heavy Chassis", weight: 10 },
      ],
    },
    {
      key: "gear",
      label: "Gear",
      options: [
        { name: "Tool Belt", weight: 42 },
        { name: "Spare Bits", weight: 28 },
        { name: "Fuel Tank", weight: 20 },
        { name: "Chain Rig", weight: 10 },
      ],
    },
    {
      key: "face",
      label: "Eyes/Face",
      options: [
        { name: "Goggles", weight: 38 },
        { name: "Grime Mask", weight: 30 },
        { name: "Bare Eyes", weight: 24 },
        { name: "Welding Visor", weight: 8 },
      ],
    },
  ],
  blaster: [
    {
      key: "charge",
      label: "Charge Type",
      options: [
        { name: "Single Charge", weight: 40 },
        { name: "Charge Belt", weight: 30 },
        { name: "Detonator", weight: 20 },
        { name: "Overcharged Rig", weight: 10 },
      ],
    },
    {
      key: "stance",
      label: "Stance",
      options: [
        { name: "Braced", weight: 35 },
        { name: "Crouched", weight: 30 },
        { name: "Mid-Throw", weight: 25 },
        { name: "Sprinting", weight: 10 },
      ],
    },
    {
      key: "marking",
      label: "Marking",
      options: [
        { name: "Clean Rig", weight: 42 },
        { name: "Scorch Marks", weight: 28 },
        { name: "Warning Stripes", weight: 20 },
        { name: "Fuse Line", weight: 10 },
      ],
    },
    {
      key: "face",
      label: "Eyes/Face",
      options: [
        { name: "Bare Eyes", weight: 38 },
        { name: "Blast Shield", weight: 30 },
        { name: "Cracked Visor", weight: 24 },
        { name: "Wide Grin", weight: 8 },
      ],
    },
  ],
  warden: [
    {
      key: "armor",
      label: "Armor",
      options: [
        { name: "Chest Guard", weight: 40 },
        { name: "Light Frame", weight: 30 },
        { name: "Reinforced Shoulders", weight: 20 },
        { name: "Full Plate", weight: 10 },
      ],
    },
    {
      key: "emblem",
      label: "Emblem",
      options: [
        { name: "No Sigil", weight: 35 },
        { name: "Shield Sigil", weight: 30 },
        { name: "Lantern Sigil", weight: 25 },
        { name: "Twin Sigil", weight: 10 },
      ],
    },
    {
      key: "stance",
      label: "Stance",
      options: [
        { name: "Standing Guard", weight: 42 },
        { name: "Watching", weight: 28 },
        { name: "Arms Crossed", weight: 20 },
        { name: "Kneeling", weight: 10 },
      ],
    },
    {
      key: "face",
      label: "Eyes/Face",
      options: [
        { name: "Visor Slit", weight: 38 },
        { name: "Bare Eyes", weight: 30 },
        { name: "Full Helm", weight: 24 },
        { name: "Glowing Eyes", weight: 8 },
      ],
    },
  ],
};

export type MinerTraits = {
  rig: Rig;
  /** Category key -> chosen option name. Four entries, always. */
  picks: Record<string, string>;
};

function weightedPick(options: Option[], roll: number): Option {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = roll * total;
  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option;
  }
  return options[options.length - 1];
}

// Turn an assay seed into a miner.
export function assayTraits(seed: number, rig: Rig): MinerTraits {
  const rng = createRng(seed);
  const picks: Record<string, string> = {};
  for (const category of TRAIT_POOLS[rig]) {
    picks[category.key] = weightedPick(category.options, rng.next()).name;
  }
  return { rig, picks };
}

// Rarity as information content:
export function rarityScore(traits: MinerTraits): number {
  const rigTotal = RIGS.reduce((sum, rig) => sum + RIG_WEIGHT[rig], 0);
  let bits = -Math.log2(RIG_WEIGHT[traits.rig] / rigTotal);

  for (const category of TRAIT_POOLS[traits.rig]) {
    const total = category.options.reduce((sum, option) => sum + option.weight, 0);
    const chosen = category.options.find((option) => option.name === traits.picks[category.key]);
    // An unknown option means the pools moved under stored data; treat it as
    // the commonest case rather than scoring it as infinitely rare.
    const weight = chosen?.weight ?? Math.max(...category.options.map((o) => o.weight));
    bits += -Math.log2(weight / total);
  }

  return Math.round(bits * 100) / 100;
}

/** Category label plus chosen option, in display order. */
export function traitList(traits: MinerTraits): { label: string; value: string }[] {
  return TRAIT_POOLS[traits.rig].map((category) => ({
    label: category.label,
    value: traits.picks[category.key] ?? ",",
  }));
}
