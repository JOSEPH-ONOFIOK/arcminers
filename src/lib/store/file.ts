import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { seamMultiplier } from "@/lib/shaft/engine";
import { SPOTS, TIER_RULES, TIERS, type Rig, type Tier } from "@/lib/shaft/rules";
import type {
  Claim,
  Dig,
  Entry,
  JoinResult,
  Player,
  SeamState,
  ShaftStore,
  Shield,
  Tx,
} from "./types";

export type Shape = {
  players: Record<string, Player>;
  digs: Dig[];
  seams: Record<string, { total: number; remaining: number }>;
  shields: Shield[];
  entries: Record<string, Omit<Entry, "likes">>;
  votes: { entry: string; voter: string }[];
  claims: Claim[];
};

const EMPTY: Shape = {
  players: {},
  digs: [],
  seams: {},
  shields: [],
  entries: {},
  votes: [],
  claims: [],
};

// JSON-file store, for development only.
export class FileStore implements ShaftStore {
  protected readonly path: string;
  protected queue: Promise<unknown> = Promise.resolve();

  constructor(path?: string) {
    this.path = path ?? ".data/shaft.json";
  }

  protected read(): Shape {
    try {
      return { ...EMPTY, ...JSON.parse(readFileSync(this.path, "utf8")) };
    } catch {
      return structuredClone(EMPTY);
    }
  }

  protected write(data: Shape): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(data, null, 2));
  }

  /** Serialise every mutation, so a read and its write are never interleaved. */
  protected lock<T>(run: (data: Shape) => T | Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      const data = this.read();
      const result = await run(data);
      this.write(data);
      return result;
    });
    this.queue = next.catch(() => {});
    return next;
  }

  async getPlayer(handle: string): Promise<Player | null> {
    return this.read().players[handle.toLowerCase()] ?? null;
  }

  async enlist(handle: string, rig: Rig, now: number, startedAt: number): Promise<Player> {
    return this.lock((data) => {
      const lower = handle.toLowerCase();
      // The rig is locked on first enlistment and never reassigned.
      if (!data.players[lower]) {
        data.players[lower] = {
          handle,
          rig,
          startedAt,
          picksSpent: 0,
          tier: "surface",
          tierSince: now,
          deepestTier: "surface",
          oreBanked: 0,
          oreLoose: 0,
          faultPp: 0,
          digs: 0,
          caveIns: 0,
          saved: 0,
          shieldValue: 0,
        };
      }
      return data.players[lower];
    });
  }

  async withPlayer<T>(handle: string, run: (tx: Tx) => Promise<T>): Promise<T> {
    return this.lock(async (data) => {
      const lower = handle.toLowerCase();
      const player = data.players[lower];
      if (!player) throw new Error("no such player");
      return run(new FileTx(data, player, lower));
    });
  }

  async digLog(handle: string, limit: number): Promise<Dig[]> {
    const lower = handle.toLowerCase();
    return this.read()
      .digs.filter((dig) => dig.handle === lower)
      .sort((a, b) => b.seq - a.seq)
      .slice(0, limit);
  }

  async seams(day: string): Promise<SeamState[]> {
    const data = this.read();
    return TIERS.map((tier) => {
      const seam = data.seams[`${day}:${tier}`];
      return {
        tier,
        total: TIER_RULES[tier].dailyPool,
        remaining: seam ? seam.remaining : TIER_RULES[tier].dailyPool,
      };
    });
  }

  async roster(): Promise<Player[]> {
    return Object.values(this.read().players);
  }

  async shieldsFor(target: string, now: number): Promise<Shield[]> {
    const lower = target.toLowerCase();
    return this.read()
      .shields.filter((s) => s.target === lower && !s.consumedBy && s.expiresAt > now)
      .sort((a, b) => a.placedAt - b.placedAt);
  }

  async wardenShields(warden: string): Promise<Shield[]> {
    const lower = warden.toLowerCase();
    return this.read()
      .shields.filter((s) => s.warden === lower)
      .sort((a, b) => b.placedAt - a.placedAt)
      .slice(0, 50);
  }

  async saveEntry(entry: Omit<Entry, "likes">): Promise<Entry> {
    return this.lock((data) => {
      data.entries[entry.handle.toLowerCase()] = entry;
      return { ...entry, likes: this.countVotes(data, entry.handle.toLowerCase()) };
    });
  }

  protected countVotes(data: Shape, handle: string): number {
    return data.votes.filter((vote) => vote.entry === handle).length;
  }

  async getEntry(handle: string): Promise<Entry | null> {
    const data = this.read();
    const lower = handle.toLowerCase();
    const entry = data.entries[lower];
    return entry ? { ...entry, likes: this.countVotes(data, lower) } : null;
  }

  async listEntries(): Promise<Entry[]> {
    const data = this.read();
    return Object.entries(data.entries).map(([lower, entry]) => ({
      ...entry,
      likes: this.countVotes(data, lower),
    }));
  }

  async like(handle: string, voterId: string): Promise<{ likes: number; liked: boolean } | null> {
    return this.lock((data) => {
      const lower = handle.toLowerCase();
      if (!data.entries[lower]) return null;
      if (!data.votes.some((vote) => vote.entry === lower && vote.voter === voterId)) {
        data.votes.push({ entry: lower, voter: voterId });
      }
      return { likes: this.countVotes(data, lower), liked: true };
    });
  }

  async likedBy(voterId: string): Promise<string[]> {
    return this.read()
      .votes.filter((vote) => vote.voter === voterId)
      .map((vote) => vote.entry);
  }

  async joinAllowlist(handle: string, wallet: string, sigil: string): Promise<JoinResult> {
    return this.lock((data) => {
      const lower = handle.toLowerCase();
      if (data.claims.some((claim) => claim.handle.toLowerCase() === lower)) {
        return { ok: false, taken: "handle" };
      }
      if (data.claims.some((claim) => claim.wallet.toLowerCase() === wallet.toLowerCase())) {
        return { ok: false, taken: "wallet" };
      }
      if (data.claims.length >= SPOTS.total) return { ok: false, taken: "full" };

      const claim: Claim = {
        handle,
        wallet,
        sigil,
        position: data.claims.length + 1,
        joinedAt: Date.now(),
      };
      data.claims.push(claim);
      return { ok: true, claim };
    });
  }

  async getClaim(handle: string): Promise<Claim | null> {
    const lower = handle.toLowerCase();
    return this.read().claims.find((claim) => claim.handle.toLowerCase() === lower) ?? null;
  }

  async countAllowlist(): Promise<number> {
    return this.read().claims.length;
  }
}

class FileTx implements Tx {
  constructor(
    private readonly data: Shape,
    public player: Player,
    private readonly lower: string,
  ) {}

  async savePlayer(next: Player): Promise<void> {
    this.data.players[this.lower] = next;
    this.player = next;
  }

  async insertDig(dig: Dig): Promise<void> {
    this.data.digs.push({ ...dig, handle: this.lower });
  }

  async getDig(id: string): Promise<Dig | null> {
    return this.data.digs.find((dig) => dig.id === id && dig.handle === this.lower) ?? null;
  }

  async updateDig(dig: Dig): Promise<void> {
    const index = this.data.digs.findIndex((candidate) => candidate.id === dig.id);
    if (index >= 0) this.data.digs[index] = { ...dig, handle: this.lower };
  }

  async takeSeam(day: string, tier: Tier, rawOre: number): Promise<{ granted: number; multiplier: number }> {
    const key = `${day}:${tier}`;
    const total = TIER_RULES[tier].dailyPool;
    const seam = (this.data.seams[key] ??= { total, remaining: total });
    const multiplier = seamMultiplier(seam.remaining, seam.total);
    const granted = Math.min(Math.round(rawOre * multiplier), seam.remaining);
    seam.remaining -= granted;
    return { granted, multiplier };
  }

  async activeShield(target: string, now: number): Promise<Shield | null> {
    const lower = target.toLowerCase();
    return (
      this.data.shields
        .filter((s) => s.target === lower && !s.consumedBy && s.expiresAt > now)
        .sort((a, b) => a.placedAt - b.placedAt)[0] ?? null
    );
  }

  async consumeShield(id: string, digId: string, value: number): Promise<void> {
    const shield = this.data.shields.find((s) => s.id === id && !s.consumedBy);
    if (!shield) return;
    shield.consumedBy = digId;
    const warden = this.data.players[shield.warden];
    if (warden) warden.shieldValue += value;
  }

  async insertShield(shield: Shield): Promise<void> {
    this.data.shields.push({
      ...shield,
      warden: shield.warden.toLowerCase(),
      target: shield.target.toLowerCase(),
    });
  }
}
