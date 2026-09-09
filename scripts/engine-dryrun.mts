// Runs the whole loop against a real store, with no server.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "shaft-"));
process.env.ARC_DB_PATH = join(dir, "shaft.json");
process.env.ARC_SEED_SECRET = "dryrun";
delete process.env.DATABASE_URL;
delete process.env.ARC_WINDOW_OPEN;
delete process.env.ARC_WINDOW_CLOSE;

const { bank, commitDig, descend, enlist, placeShield, revealDig } = await import(
  "../src/lib/server/actions"
);
const { getStore } = await import("../src/lib/store");
const { REVEAL_DELAY_MS, TIER_RULES, tierIndex } = await import("../src/lib/shaft/rules");
const { assayFor } = await import("../src/lib/server/assay");

let failures = 0;
function check(label: string, condition: boolean): void {
  if (!condition) {
    failures++;
    console.error(`  FAIL  ${label}`);
  }
}

const store = getStore();
const HOUR = 3_600_000;
let clock = Date.parse("2026-10-01T00:00:00Z");

await enlist("digger", "prospector", clock);
await enlist("keeper", "warden", clock);

// A rig is locked on first enlistment. A second attempt must not reassign it.
await enlist("digger", "blaster", clock);
check("rig is locked after enlistment", (await store.getPlayer("digger"))!.rig === "prospector");

let collapses = 0;
let seamPaid = 0;

// Funded deliberately, and pushed to Deep Cave before the loop starts. A run
// that stays on the Surface never rolls for the roof, so every cave-in
// invariant below would pass by never being reached, which is worse than
// failing, because it looks like coverage.
await store.withPlayer("digger", async (tx) => {
  await tx.savePlayer({ ...tx.player, oreBanked: 5_000 });
});
await descend("digger", clock);
await descend("digger", clock);

for (let round = 0; round < 120; round++) {
  clock += HOUR / 4;
  const before = (await store.getPlayer("digger"))!;

  const committed = await commitDig("digger", clock);
  if (!committed.ok) continue;

  // Revealing early must be refused, that delay is the whole mechanic.
  const early = await revealDig("digger", committed.dig.id, clock + 1000);
  check("reveal before the delay is refused", !early.ok);

  clock += REVEAL_DELAY_MS + 1000;
  const revealed = await revealDig("digger", committed.dig.id, clock);
  if (!revealed.ok) continue;

  const after = revealed.player;
  check("ore only ever comes from an ore patch", revealed.dig.patch === "ore" || revealed.dig.ore === 0);
  seamPaid += revealed.dig.ore;

  if (revealed.dig.caveIn) {
    collapses++;
    check("a collapse costs exactly one tier", tierIndex(after.tier) === tierIndex(before.tier) - 1);
    check("a collapse takes everything loose", after.oreLoose === 0);
    check("a collapse never touches banked ore", after.oreBanked === before.oreBanked);
  } else {
    check("loose ore only grows on a quiet dig", after.oreLoose >= before.oreLoose);
  }

  // Revealing twice must return the first answer rather than rolling again.
  const replay = await revealDig("digger", committed.dig.id, clock + 5000);
  check("reveal is idempotent", replay.ok && replay.dig.ore === revealed.dig.ore);

  if (after.oreLoose > 0 && round % 4 === 3) {
    const banked = await bank("digger", clock);
    if (banked.ok) check("banking clears the fault count", banked.player.faultPp === 0);
  }

  // Climb straight back down after a collapse, so the rest of the run keeps
  // rolling against the roof instead of quietly finishing at the Surface.
  const player = (await store.getPlayer("digger"))!;
  if (player.tier !== "deep" && player.oreBanked >= 1_000) await descend("digger", clock);
}

const digger = (await store.getPlayer("digger"))!;
check("the run actually dug", digger.digs > 20);
check("the run actually rolled against the roof", collapses > 0);

const seams = await store.seams(new Date(clock).toISOString().slice(0, 10));
for (const seam of seams) {
  check(`${seam.tier} seam never goes negative`, seam.remaining >= 0);
  check(`${seam.tier} seam never exceeds its pool`, seam.remaining <= seam.total);
}

// Descending: refused without the ore, and it moves exactly one tier when paid.
const before = (await store.getPlayer("digger"))!;
await store.withPlayer("digger", async (tx) => {
  await tx.savePlayer({ ...tx.player, oreBanked: 100_000 });
});
const descended = await descend("digger", clock);
check("descending moves exactly one tier", descended.ok && tierIndex(descended.player.tier) === tierIndex(before.tier) + 1);
check(
  "descending charges the rig's cost",
  descended.ok && descended.cost === TIER_RULES[descended.player.tier].descendCost,
);

// Wardens: cannot cover themselves, cannot stack, and only Wardens can cover.
check("a warden cannot shield themselves", !(await placeShield("keeper", "keeper", clock)).ok);
check("a non-warden cannot place shields", !(await placeShield("digger", "keeper", clock)).ok);
const first = await placeShield("keeper", "digger", clock);
check("a warden can cover somebody else", first.ok);
check("a warden cannot stack cover", !(await placeShield("keeper", "digger", clock)).ok);

// The assay is a pure function of the log.
const assayA = await assayFor((await store.getPlayer("digger"))!);
const assayB = await assayFor((await store.getPlayer("digger"))!);
check("the assay is deterministic", assayA.seed === assayB.seed && assayA.tag === assayB.tag);
check("the assay produces four traits", Object.keys(assayA.traits.picks).length === 4);

// One spot per handle, one per wallet.
await store.saveEntry({
  handle: "digger",
  digTag: assayA.tag,
  seed: assayA.seed,
  rig: "prospector",
  tier: assayA.tier,
  traits: assayA.traits,
  rarity: assayA.rarity,
  postId: "1",
  verifiedAt: clock,
});
const wallet = "0x" + "a".repeat(40);
check("a first claim is accepted", (await store.joinAllowlist("digger", wallet, "WL-000001")).ok);
check("one spot per handle", !(await store.joinAllowlist("digger", "0x" + "b".repeat(40), "WL-2")).ok);
check("one spot per wallet", !(await store.joinAllowlist("someone", wallet, "WL-3")).ok);

rmSync(dir, { recursive: true, force: true });

console.log(
  `${digger.digs} digs · ${collapses} collapses · ${seamPaid} ore taken from seams · ${digger.oreBanked} banked`,
);
if (failures > 0) {
  console.error(`\n${failures} invariant(s) broken`);
  process.exit(1);
}
console.log("all invariants held");
