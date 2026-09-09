// The miner, drawn.

import { TIER_RULES, type Rig, type Tier } from "./rules";
import type { MinerTraits } from "./traits";

export const SIZE = 40;

/** Palette slots. 0 is empty; 6 is whatever the current tier lights up. */
const EMPTY = 0;
const INK = 1;
const DARK = 2;
const MID = 3;
const LIGHT = 4;
const PALE = 5;
const LIT = 6;

const BASE_RAMP = ["", "#0e0c0a", "#2f2a24", "#574f45", "#8b8175", "#bdb4a6"];

type Grid = Uint8Array;

function make(): Grid {
  return new Uint8Array(SIZE * SIZE);
}

function px(g: Grid, x: number, y: number, c: number): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  g[y * SIZE + x] = c;
}

function rect(g: Grid, x: number, y: number, w: number, h: number, c: number): void {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) px(g, x + dx, y + dy, c);
}

/** Filled block with a darker edge, the workhorse, since everything is a plate. */
function plate(g: Grid, x: number, y: number, w: number, h: number, fill: number, edge: number): void {
  rect(g, x, y, w, h, fill);
  for (let dx = 0; dx < w; dx++) {
    px(g, x + dx, y, edge);
    px(g, x + dx, y + h - 1, edge);
  }
  for (let dy = 0; dy < h; dy++) {
    px(g, x, y + dy, edge);
    px(g, x + w - 1, y + dy, edge);
  }
}

// ---------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------

/** Legs and boots. Stance traits overwrite these, so they go down first. */
function legs(g: Grid, leftX: number, rightX: number, top: number): void {
  plate(g, leftX, top, 4, 38 - top, MID, DARK);
  plate(g, rightX, top, 4, 38 - top, MID, DARK);
  rect(g, leftX - 1, 36, 5, 2, DARK);
  rect(g, rightX, 36, 5, 2, DARK);
  rect(g, leftX - 1, 37, 5, 1, INK);
  rect(g, rightX, 37, 5, 1, INK);
}

function head(g: Grid): void {
  plate(g, 15, 6, 10, 10, MID, DARK);
  rect(g, 16, 7, 8, 3, LIGHT);
  rect(g, 18, 15, 4, 2, DARK);
}

function body(g: Grid, rig: Rig): void {
  switch (rig) {
    case "prospector":
      legs(g, 16, 21, 29);
      plate(g, 15, 17, 10, 11, MID, DARK);
      plate(g, 12, 18, 3, 9, MID, DARK);
      plate(g, 25, 18, 3, 9, MID, DARK);
      break;
    case "driller":
      legs(g, 15, 22, 30);
      plate(g, 13, 17, 14, 13, MID, DARK);
      plate(g, 10, 18, 3, 10, MID, DARK);
      rect(g, 14, 18, 12, 1, LIGHT);
      break;
    case "blaster":
      legs(g, 16, 21, 29);
      plate(g, 15, 17, 10, 12, MID, DARK);
      plate(g, 12, 18, 3, 9, MID, DARK);
      plate(g, 25, 18, 3, 9, MID, DARK);
      // Strap across the chest, the thing every charge trait hangs off.
      for (let i = 0; i < 9; i++) px(g, 16 + i, 19 + Math.floor(i / 2), DARK);
      break;
    case "warden":
      legs(g, 16, 21, 30);
      plate(g, 14, 17, 12, 13, MID, DARK);
      plate(g, 11, 17, 4, 4, LIGHT, DARK);
      plate(g, 25, 17, 4, 4, LIGHT, DARK);
      plate(g, 11, 21, 3, 7, MID, DARK);
      plate(g, 26, 21, 3, 7, MID, DARK);
      break;
  }
  head(g);
}

// ---------------------------------------------------------------------------
// Prospector
// ---------------------------------------------------------------------------

function prospector(g: Grid, t: Record<string, string>): void {
  switch (t.headgear) {
    case "Cloth Cap":
      rect(g, 14, 4, 12, 3, DARK);
      rect(g, 13, 6, 14, 1, INK);
      break;
    case "Miner's Hat":
      rect(g, 14, 3, 12, 4, DARK);
      rect(g, 14, 5, 12, 1, LIGHT);
      rect(g, 12, 6, 16, 1, INK);
      break;
    case "Bandana":
      rect(g, 14, 4, 12, 3, LIGHT);
      rect(g, 25, 6, 3, 3, LIGHT);
      break;
    default:
      rect(g, 15, 5, 10, 1, DARK);
  }

  switch (t.light) {
    case "Candle":
      rect(g, 11, 23, 2, 4, PALE);
      px(g, 11, 22, LIT);
      px(g, 12, 22, LIT);
      break;
    case "Single Lamp":
      plate(g, 10, 22, 4, 4, DARK, INK);
      rect(g, 11, 23, 2, 2, LIT);
      break;
    case "Dual Lamp":
      plate(g, 10, 22, 4, 4, DARK, INK);
      rect(g, 11, 23, 2, 2, LIT);
      rect(g, 18, 3, 4, 2, DARK);
      rect(g, 19, 4, 2, 1, LIT);
      break;
  }

  switch (t.tool) {
    case "Pickaxe":
      rect(g, 29, 17, 1, 11, DARK);
      rect(g, 27, 16, 6, 1, LIGHT);
      px(g, 26, 17, PALE);
      px(g, 33, 17, PALE);
      break;
    case "Pan":
      rect(g, 28, 24, 6, 1, PALE);
      rect(g, 29, 25, 4, 2, LIGHT);
      break;
    case "Rope":
      rect(g, 28, 21, 5, 1, LIGHT);
      rect(g, 28, 23, 5, 1, LIGHT);
      rect(g, 28, 25, 5, 1, LIGHT);
      break;
  }

  face(g, t.face);
}

// ---------------------------------------------------------------------------
// Driller
// ---------------------------------------------------------------------------

function driller(g: Grid, t: Record<string, string>): void {
  switch (t.frame) {
    case "Patched Frame":
      plate(g, 16, 20, 4, 4, LIGHT, DARK);
      plate(g, 21, 24, 4, 3, LIGHT, DARK);
      break;
    case "Reinforced Plating":
      rect(g, 14, 20, 12, 2, LIGHT);
      rect(g, 14, 24, 12, 2, LIGHT);
      break;
    case "Heavy Chassis":
      plate(g, 12, 17, 16, 13, DARK, INK);
      rect(g, 14, 19, 12, 9, MID);
      px(g, 13, 18, PALE);
      px(g, 26, 18, PALE);
      px(g, 13, 28, PALE);
      px(g, 26, 28, PALE);
      break;
  }

  switch (t.rigtype) {
    case "Hand Drill":
      plate(g, 27, 18, 3, 8, MID, DARK);
      plate(g, 29, 20, 4, 3, LIGHT, DARK);
      rect(g, 33, 21, 3, 1, PALE);
      px(g, 36, 21, LIT);
      break;
    case "Mounted Drill":
      plate(g, 26, 15, 5, 5, DARK, INK);
      plate(g, 30, 16, 5, 3, LIGHT, DARK);
      rect(g, 35, 17, 3, 1, PALE);
      px(g, 38, 17, LIT);
      break;
    case "Twin Drill":
      plate(g, 27, 17, 4, 4, LIGHT, DARK);
      plate(g, 27, 23, 4, 4, LIGHT, DARK);
      rect(g, 31, 18, 4, 1, PALE);
      rect(g, 31, 24, 4, 1, PALE);
      px(g, 35, 18, LIT);
      px(g, 35, 24, LIT);
      break;
    case "Jackhammer":
      plate(g, 28, 15, 4, 12, DARK, INK);
      rect(g, 29, 17, 2, 8, LIGHT);
      rect(g, 29, 27, 2, 6, PALE);
      px(g, 29, 33, LIT);
      px(g, 30, 33, LIT);
      break;
  }

  switch (t.gear) {
    case "Tool Belt":
      rect(g, 14, 26, 13, 2, DARK);
      rect(g, 19, 26, 2, 2, PALE);
      break;
    case "Spare Bits":
      rect(g, 15, 26, 2, 2, PALE);
      rect(g, 18, 26, 2, 2, PALE);
      rect(g, 21, 26, 2, 2, PALE);
      break;
    case "Fuel Tank":
      plate(g, 9, 19, 4, 8, DARK, INK);
      rect(g, 10, 18, 2, 1, PALE);
      rect(g, 13, 22, 2, 1, DARK);
      break;
    case "Chain Rig":
      for (let x = 14; x < 27; x += 2) px(g, x, 25, PALE);
      for (let x = 15; x < 27; x += 2) px(g, x, 26, DARK);
      break;
  }

  face(g, t.face);
}

// ---------------------------------------------------------------------------
// Blaster
// ---------------------------------------------------------------------------

function blaster(g: Grid, t: Record<string, string>): void {
  switch (t.stance) {
    case "Crouched":
      rect(g, 11, 28, 18, 12, EMPTY);
      rect(g, 15, 28, 11, 2, DARK);
      plate(g, 14, 30, 5, 4, MID, DARK);
      plate(g, 21, 30, 5, 4, MID, DARK);
      legs(g, 15, 21, 33);
      break;
    case "Mid-Throw":
      rect(g, 25, 18, 3, 8, EMPTY);
      plate(g, 26, 12, 3, 8, MID, DARK);
      break;
    case "Sprinting":
      rect(g, 11, 28, 18, 12, EMPTY);
      rect(g, 15, 28, 11, 1, DARK);
      plate(g, 13, 30, 5, 4, MID, DARK);
      plate(g, 15, 33, 4, 5, MID, DARK);
      plate(g, 22, 29, 4, 6, MID, DARK);
      plate(g, 23, 34, 5, 4, MID, DARK);
      break;
    case "Braced":
      rect(g, 11, 28, 18, 12, EMPTY);
      rect(g, 14, 28, 13, 1, DARK);
      legs(g, 13, 23, 29);
      break;
  }

  switch (t.charge) {
    case "Single Charge":
      plate(g, 26, 22, 3, 5, LIGHT, DARK);
      px(g, 27, 21, LIT);
      break;
    case "Charge Belt":
      rect(g, 14, 26, 12, 2, DARK);
      rect(g, 15, 24, 2, 2, LIGHT);
      rect(g, 18, 24, 2, 2, LIGHT);
      rect(g, 21, 24, 2, 2, LIGHT);
      px(g, 15, 23, LIT);
      px(g, 18, 23, LIT);
      px(g, 21, 23, LIT);
      break;
    case "Detonator":
      plate(g, 27, 22, 5, 5, DARK, INK);
      rect(g, 29, 20, 1, 2, PALE);
      px(g, 29, 19, LIT);
      break;
    case "Overcharged Rig":
      plate(g, 10, 17, 4, 10, DARK, INK);
      rect(g, 11, 19, 2, 2, LIT);
      rect(g, 11, 22, 2, 2, LIT);
      rect(g, 11, 25, 2, 1, LIT);
      break;
  }

  switch (t.marking) {
    case "Scorch Marks":
      px(g, 17, 21, INK);
      px(g, 18, 22, INK);
      px(g, 22, 20, INK);
      px(g, 23, 21, INK);
      px(g, 20, 25, INK);
      break;
    case "Warning Stripes":
      for (let y = 20; y < 26; y++) {
        for (let x = 16; x < 24; x++) if ((x + y) % 4 < 2) px(g, x, y, PALE);
      }
      break;
    case "Fuse Line":
      for (let i = 0; i < 7; i++) px(g, 16 + i, 25 - i, LIT);
      break;
  }

  face(g, t.face);
}

// ---------------------------------------------------------------------------
// Warden
// ---------------------------------------------------------------------------

function warden(g: Grid, t: Record<string, string>): void {
  switch (t.armor) {
    case "Chest Guard":
      plate(g, 15, 18, 10, 9, LIGHT, DARK);
      break;
    case "Light Frame":
      plate(g, 16, 19, 8, 7, MID, DARK);
      break;
    case "Reinforced Shoulders":
      plate(g, 9, 15, 6, 6, LIGHT, DARK);
      plate(g, 25, 15, 6, 6, LIGHT, DARK);
      break;
    case "Full Plate":
      plate(g, 13, 16, 14, 14, LIGHT, DARK);
      plate(g, 9, 15, 6, 6, LIGHT, DARK);
      plate(g, 25, 15, 6, 6, LIGHT, DARK);
      rect(g, 16, 30, 4, 5, LIGHT);
      rect(g, 21, 30, 4, 5, LIGHT);
      break;
  }

  switch (t.emblem) {
    case "Shield Sigil":
      rect(g, 18, 20, 4, 3, LIT);
      rect(g, 19, 23, 2, 1, LIT);
      break;
    case "Lantern Sigil":
      rect(g, 19, 20, 2, 4, LIT);
      px(g, 18, 21, LIT);
      px(g, 21, 21, LIT);
      break;
    case "Twin Sigil":
      rect(g, 17, 21, 2, 2, LIT);
      rect(g, 21, 21, 2, 2, LIT);
      break;
  }

  switch (t.stance) {
    case "Standing Guard":
      rect(g, 30, 10, 1, 24, DARK);
      rect(g, 29, 9, 3, 2, LIGHT);
      px(g, 30, 8, LIT);
      break;
    case "Arms Crossed":
      plate(g, 13, 21, 14, 3, MID, DARK);
      break;
    case "Watching":
      plate(g, 13, 6, 6, 2, MID, DARK);
      break;
    case "Kneeling":
      rect(g, 13, 29, 17, 11, EMPTY);
      plate(g, 16, 29, 4, 6, MID, DARK);
      plate(g, 21, 32, 7, 3, MID, DARK);
      rect(g, 15, 35, 6, 2, INK);
      break;
  }

  face(g, t.face);
}

// ---------------------------------------------------------------------------
// Faces, shared vocabulary, since every type has an Eyes/Face category
// ---------------------------------------------------------------------------

function face(g: Grid, option: string): void {
  switch (option) {
    case "Squint":
      rect(g, 17, 11, 2, 1, INK);
      rect(g, 21, 11, 2, 1, INK);
      rect(g, 18, 13, 4, 1, DARK);
      break;
    case "Wide-Eyed":
      rect(g, 17, 10, 2, 2, PALE);
      rect(g, 21, 10, 2, 2, PALE);
      px(g, 18, 11, INK);
      px(g, 22, 11, INK);
      rect(g, 19, 13, 2, 1, DARK);
      break;
    case "Dust Mask":
      rect(g, 17, 10, 2, 1, INK);
      rect(g, 21, 10, 2, 1, INK);
      plate(g, 16, 12, 8, 3, PALE, DARK);
      break;
    case "Clean Face":
      rect(g, 17, 10, 2, 2, INK);
      rect(g, 21, 10, 2, 2, INK);
      rect(g, 18, 13, 4, 1, DARK);
      break;
    case "Goggles":
      plate(g, 15, 9, 10, 4, DARK, INK);
      rect(g, 16, 10, 3, 2, PALE);
      rect(g, 21, 10, 3, 2, PALE);
      break;
    case "Welding Visor":
      plate(g, 14, 6, 12, 8, DARK, INK);
      rect(g, 16, 10, 8, 1, LIT);
      break;
    case "Grime Mask":
      rect(g, 17, 10, 2, 1, INK);
      rect(g, 21, 10, 2, 1, INK);
      rect(g, 15, 12, 10, 3, DARK);
      break;
    case "Bare Eyes":
      rect(g, 17, 10, 2, 2, INK);
      rect(g, 21, 10, 2, 2, INK);
      break;
    case "Blast Shield":
      plate(g, 14, 7, 12, 7, MID, INK);
      rect(g, 16, 10, 8, 2, LIT);
      break;
    case "Cracked Visor":
      plate(g, 15, 8, 10, 6, LIGHT, DARK);
      px(g, 18, 9, INK);
      px(g, 19, 10, INK);
      px(g, 19, 11, INK);
      px(g, 20, 12, INK);
      px(g, 21, 13, INK);
      break;
    case "Wide Grin":
      rect(g, 17, 10, 2, 2, INK);
      rect(g, 21, 10, 2, 2, INK);
      rect(g, 17, 13, 7, 2, PALE);
      px(g, 19, 13, DARK);
      px(g, 21, 13, DARK);
      break;
    case "Visor Slit":
      plate(g, 14, 6, 12, 10, DARK, INK);
      rect(g, 16, 11, 8, 1, LIT);
      break;
    case "Full Helm":
      plate(g, 14, 5, 12, 11, MID, INK);
      rect(g, 19, 9, 2, 5, DARK);
      break;
    case "Glowing Eyes":
      rect(g, 17, 10, 2, 2, LIT);
      rect(g, 21, 10, 2, 2, LIT);
      break;
    default:
      rect(g, 17, 10, 2, 2, INK);
      rect(g, 21, 10, 2, 2, INK);
  }
}

// ---------------------------------------------------------------------------
// Paint, then emit
// ---------------------------------------------------------------------------

export function paint(traits: MinerTraits): Grid {
  const g = make();
  body(g, traits.rig);
  const t = traits.picks;
  if (traits.rig === "prospector") prospector(g, t);
  else if (traits.rig === "driller") driller(g, t);
  else if (traits.rig === "blaster") blaster(g, t);
  else warden(g, t);
  return g;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const channel = (x: number, y: number) => Math.round(x + (y - x) * amount);
  return `#${[channel(ar, br), channel(ag, bg), channel(ab, bb)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

// Run-length encode one palette index into a single path.
function pathFor(g: Grid, index: number): string {
  let d = "";
  for (let y = 0; y < SIZE; y++) {
    let x = 0;
    while (x < SIZE) {
      if (g[y * SIZE + x] !== index) {
        x++;
        continue;
      }
      let run = 0;
      while (x + run < SIZE && g[y * SIZE + x + run] === index) run++;
      d += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  }
  return d;
}

export type RenderOptions = {
  /** Unique per instance on a page, so filters can't collide. */
  id?: string;
  /** Draw the rock plate behind the miner. Off for cards that supply their own. */
  background?: boolean;
};

export function renderMinerSvg(
  traits: MinerTraits,
  tier: Tier,
  options: RenderOptions = {},
): string {
  const g = paint(traits);
  const rule = TIER_RULES[tier];
  const id = options.id ?? "m";
  const strength = rule.glowStrength;

  // Depth tints the whole palette, not just the lit pixels, the miner reads
  // as being *in* the light rather than carrying it.
  const ramp = BASE_RAMP.map((hex) => (hex ? mix(hex, rule.glow, strength * 0.18) : hex));

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges" role="img">`,
  );

  if (strength > 0) {
    parts.push(
      `<defs><filter id="glow-${id}" x="-60%" y="-60%" width="220%" height="220%">` +
        `<feGaussianBlur stdDeviation="${(0.8 + strength * 1.6).toFixed(2)}"/>` +
        `</filter></defs>`,
    );
  }

  if (options.background !== false) {
    parts.push(`<rect width="${SIZE}" height="${SIZE}" fill="${mix("#0c0a08", rule.glow, strength * 0.1)}"/>`);
  }

  for (let index = INK; index <= PALE; index++) {
    const d = pathFor(g, index);
    if (d) parts.push(`<path d="${d}" fill="${ramp[index]}"/>`);
  }

  const litPath = pathFor(g, LIT);
  if (litPath) {
    if (strength > 0) {
      // Twice: once smeared underneath for the bloom, once crisp on top so the
      // pixel edges survive it. One pass alone either loses the glow or the art.
      parts.push(
        `<path d="${litPath}" fill="${rule.glow}" filter="url(#glow-${id})" opacity="${(0.35 + strength * 0.5).toFixed(2)}"/>`,
      );
      parts.push(`<path d="${litPath}" fill="${mix(rule.glow, "#ffffff", 0.35)}"/>`);
    } else {
      // No glow at the Surface: an unlit lamp is still a lamp, drawn dull.
      parts.push(`<path d="${litPath}" fill="${rule.glow}"/>`);
    }
  }

  parts.push("</svg>");
  return parts.join("");
}

// The tier's resolved colours, index-aligned with the grid `paint` returns.
export function palette(tier: Tier): string[] {
  const rule = TIER_RULES[tier];
  const ramp = BASE_RAMP.map((hex) => (hex ? mix(hex, rule.glow, rule.glowStrength * 0.18) : hex));
  return [...ramp, rule.glow];
}
