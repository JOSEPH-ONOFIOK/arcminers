import type { Pool, PoolClient } from "pg";
import { seamMultiplier } from "@/lib/shaft/engine";
import { TIER_RULES, TIERS, type Rig, type Tier } from "@/lib/shaft/rules";
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
import { SPOTS } from "@/lib/shaft/rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

function toPlayer(row: any): Player {
  return {
    handle: row.handle,
    rig: row.rig as Rig,
    startedAt: Number(row.started_at),
    picksSpent: row.picks_spent,
    tier: row.tier as Tier,
    tierSince: Number(row.tier_since),
    deepestTier: row.deepest_tier as Tier,
    oreBanked: Number(row.ore_banked),
    oreLoose: Number(row.ore_loose),
    faultPp: Number(row.fault_pp),
    digs: row.digs,
    caveIns: row.cave_ins,
    saved: row.saved,
    shieldValue: Number(row.shield_value),
  };
}

function toDig(row: any): Dig {
  return {
    id: row.id,
    handle: row.handle_lower,
    seq: row.seq,
    tier: row.tier as Tier,
    committedAt: Number(row.committed_at),
    revealAt: Number(row.reveal_at),
    revealedAt: row.revealed_at === null ? null : Number(row.revealed_at),
    patch: row.patch,
    ore: row.ore,
    caveIn: row.cave_in,
    shielded: row.shielded,
    odds: Number(row.odds),
  };
}

function toShield(row: any): Shield {
  return {
    id: row.id,
    warden: row.warden,
    target: row.target,
    placedAt: Number(row.placed_at),
    expiresAt: Number(row.expires_at),
    consumedBy: row.consumed_by,
  };
}

function toEntry(row: any): Entry {
  return {
    handle: row.handle,
    digTag: row.dig_tag,
    seed: Number(row.seed),
    rig: row.rig as Rig,
    tier: row.tier as Tier,
    traits: row.traits,
    rarity: Number(row.rarity),
    postId: row.post_id,
    verifiedAt: Number(row.verified_at),
    likes: Number(row.likes ?? 0),
  };
}

export class PostgresStore implements ShaftStore {
  constructor(private readonly pool: Pool) {}

  async getPlayer(handle: string): Promise<Player | null> {
    const { rows } = await this.pool.query("SELECT * FROM players WHERE handle_lower = $1", [
      handle.toLowerCase(),
    ]);
    return rows[0] ? toPlayer(rows[0]) : null;
  }

  async enlist(handle: string, rig: Rig, now: number, startedAt: number): Promise<Player> {
    const lower = handle.toLowerCase();
    await this.pool.query(
      `INSERT INTO players (handle_lower, handle, rig, started_at, tier_since)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (handle_lower) DO NOTHING`,
      [lower, handle, rig, startedAt, now],
    );
    const player = await this.getPlayer(lower);
    if (!player) throw new Error("enlist failed");
    return player;
  }

  // Every mutation runs here, inside a transaction holding the player's row.
  async withPlayer<T>(handle: string, run: (tx: Tx) => Promise<T>): Promise<T> {
    const lower = handle.toLowerCase();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query("SELECT * FROM players WHERE handle_lower = $1 FOR UPDATE", [
        lower,
      ]);
      if (!rows[0]) throw new Error("no such player");

      const result = await run(new PgTx(client, toPlayer(rows[0]), lower));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async digLog(handle: string, limit: number): Promise<Dig[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM digs WHERE handle_lower = $1 ORDER BY seq DESC LIMIT $2",
      [handle.toLowerCase(), limit],
    );
    return rows.map(toDig);
  }

  async seams(day: string): Promise<SeamState[]> {
    const { rows } = await this.pool.query("SELECT * FROM seams WHERE day = $1", [day]);
    const found = new Map<string, any>(rows.map((row: any) => [row.tier, row]));
    // A tier nobody has dug today has no row yet, and reporting it as empty
    // would tell the field a full seam is drained.
    return TIERS.map((tier) => ({
      tier,
      total: TIER_RULES[tier].dailyPool,
      remaining: found.has(tier) ? Number(found.get(tier).remaining) : TIER_RULES[tier].dailyPool,
    }));
  }

  async roster(): Promise<Player[]> {
    const { rows } = await this.pool.query("SELECT * FROM players");
    return rows.map(toPlayer);
  }

  async shieldsFor(target: string, now: number): Promise<Shield[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM shields WHERE target = $1 AND consumed_by IS NULL AND expires_at > $2
       ORDER BY placed_at ASC`,
      [target.toLowerCase(), now],
    );
    return rows.map(toShield);
  }

  async wardenShields(warden: string): Promise<Shield[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM shields WHERE warden = $1 ORDER BY placed_at DESC LIMIT 50",
      [warden.toLowerCase()],
    );
    return rows.map(toShield);
  }

  async saveEntry(entry: Omit<Entry, "likes">): Promise<Entry> {
    const { rows } = await this.pool.query(
      `INSERT INTO entries (handle_lower, handle, dig_tag, seed, rig, tier, traits, rarity, post_id, verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (handle_lower) DO UPDATE SET post_id = EXCLUDED.post_id, verified_at = EXCLUDED.verified_at
       RETURNING *`,
      [
        entry.handle.toLowerCase(),
        entry.handle,
        entry.digTag,
        entry.seed,
        entry.rig,
        entry.tier,
        JSON.stringify(entry.traits),
        entry.rarity,
        entry.postId,
        entry.verifiedAt,
      ],
    );
    return toEntry(rows[0]);
  }

  async getEntry(handle: string): Promise<Entry | null> {
    const { rows } = await this.pool.query(
      `SELECT e.*, (SELECT count(*) FROM votes v WHERE v.entry_handle = e.handle_lower) AS likes
       FROM entries e WHERE e.handle_lower = $1`,
      [handle.toLowerCase()],
    );
    return rows[0] ? toEntry(rows[0]) : null;
  }

  async listEntries(): Promise<Entry[]> {
    const { rows } = await this.pool.query(
      `SELECT e.*, (SELECT count(*) FROM votes v WHERE v.entry_handle = e.handle_lower) AS likes
       FROM entries e`,
    );
    return rows.map(toEntry);
  }

  // Idempotent per voter, and the count comes back as a delta.
  async like(handle: string, voterId: string): Promise<{ likes: number; liked: boolean } | null> {
    const lower = handle.toLowerCase();
    const { rows } = await this.pool.query(
      `WITH inserted AS (
         INSERT INTO votes (entry_handle, voter_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING 1
       )
       SELECT (SELECT count(*) FROM votes WHERE entry_handle = $1) + (SELECT count(*) FROM inserted) AS likes,
              EXISTS (SELECT 1 FROM entries WHERE handle_lower = $1) AS found`,
      [lower, voterId],
    );
    if (!rows[0]?.found) return null;
    return { likes: Number(rows[0].likes), liked: true };
  }

  async likedBy(voterId: string): Promise<string[]> {
    const { rows } = await this.pool.query("SELECT entry_handle FROM votes WHERE voter_id = $1", [
      voterId,
    ]);
    return rows.map((row: any) => row.entry_handle);
  }

  async joinAllowlist(handle: string, wallet: string, sigil: string): Promise<JoinResult> {
    const lower = handle.toLowerCase();
    try {
      const { rows } = await this.pool.query(
        `WITH taken AS (SELECT count(*) AS n FROM claims)
         INSERT INTO claims (handle_lower, handle, wallet, sigil, position, joined_at)
         SELECT $1, $2, $3, $4, taken.n + 1, $5 FROM taken WHERE taken.n < $6
         RETURNING *`,
        [lower, handle, wallet, sigil, Date.now(), SPOTS.total],
      );
      if (!rows[0]) return { ok: false, taken: "full" };
      return {
        ok: true,
        claim: {
          handle: rows[0].handle,
          wallet: rows[0].wallet,
          sigil: rows[0].sigil,
          position: rows[0].position,
          joinedAt: Number(rows[0].joined_at),
        },
      };
    } catch (error: any) {
      // 23505 is unique_violation. Which index tripped tells the form which
      // field to point at.
      if (error?.code === "23505") {
        return { ok: false, taken: error.constraint === "claims_wallet_idx" ? "wallet" : "handle" };
      }
      throw error;
    }
  }

  async getClaim(handle: string): Promise<Claim | null> {
    const { rows } = await this.pool.query("SELECT * FROM claims WHERE handle_lower = $1", [
      handle.toLowerCase(),
    ]);
    if (!rows[0]) return null;
    return {
      handle: rows[0].handle,
      wallet: rows[0].wallet,
      sigil: rows[0].sigil,
      position: rows[0].position,
      joinedAt: Number(rows[0].joined_at),
    };
  }

  async countAllowlist(): Promise<number> {
    const { rows } = await this.pool.query("SELECT count(*) AS n FROM claims");
    return Number(rows[0].n);
  }
}

class PgTx implements Tx {
  constructor(
    private readonly client: PoolClient,
    public player: Player,
    private readonly lower: string,
  ) {}

  async savePlayer(next: Player): Promise<void> {
    await this.client.query(
      `UPDATE players SET rig=$2, picks_spent=$3, tier=$4, tier_since=$5, deepest_tier=$6,
         ore_banked=$7, ore_loose=$8, fault_pp=$9, digs=$10, cave_ins=$11, saved=$12, shield_value=$13
       WHERE handle_lower=$1`,
      [
        this.lower,
        next.rig,
        next.picksSpent,
        next.tier,
        next.tierSince,
        next.deepestTier,
        next.oreBanked,
        next.oreLoose,
        next.faultPp,
        next.digs,
        next.caveIns,
        next.saved,
        next.shieldValue,
      ],
    );
    this.player = next;
  }

  async insertDig(dig: Dig): Promise<void> {
    await this.client.query(
      `INSERT INTO digs (id, handle_lower, seq, tier, committed_at, reveal_at, odds)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [dig.id, this.lower, dig.seq, dig.tier, dig.committedAt, dig.revealAt, dig.odds],
    );
  }

  async getDig(id: string): Promise<Dig | null> {
    const { rows } = await this.client.query(
      "SELECT * FROM digs WHERE id = $1 AND handle_lower = $2",
      [id, this.lower],
    );
    return rows[0] ? toDig(rows[0]) : null;
  }

  async updateDig(dig: Dig): Promise<void> {
    await this.client.query(
      `UPDATE digs SET revealed_at=$2, patch=$3, ore=$4, cave_in=$5, shielded=$6, odds=$7 WHERE id=$1`,
      [dig.id, dig.revealedAt, dig.patch, dig.ore, dig.caveIn, dig.shielded, dig.odds],
    );
  }

  // Depletion and payout in one statement.
  async takeSeam(day: string, tier: Tier, rawOre: number): Promise<{ granted: number; multiplier: number }> {
    const total = TIER_RULES[tier].dailyPool;
    await this.client.query(
      `INSERT INTO seams (day, tier, total, remaining) VALUES ($1,$2,$3,$3)
       ON CONFLICT (day, tier) DO NOTHING`,
      [day, tier, total],
    );

    const { rows } = await this.client.query(
      "SELECT remaining, total FROM seams WHERE day=$1 AND tier=$2 FOR UPDATE",
      [day, tier],
    );
    const before = Number(rows[0].remaining);
    const capacity = Number(rows[0].total);
    const multiplier = seamMultiplier(before, capacity);
    const want = Math.min(Math.round(rawOre * multiplier), before);

    await this.client.query(
      "UPDATE seams SET remaining = GREATEST(0, remaining - $3) WHERE day=$1 AND tier=$2",
      [day, tier, want],
    );
    return { granted: want, multiplier };
  }

  async activeShield(target: string, now: number): Promise<Shield | null> {
    const { rows } = await this.client.query(
      `SELECT * FROM shields WHERE target=$1 AND consumed_by IS NULL AND expires_at > $2
       ORDER BY placed_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [target.toLowerCase(), now],
    );
    return rows[0] ? toShield(rows[0]) : null;
  }

  async consumeShield(id: string, digId: string, value: number): Promise<void> {
    const { rowCount } = await this.client.query(
      "UPDATE shields SET consumed_by=$2 WHERE id=$1 AND consumed_by IS NULL RETURNING id",
      [id, digId],
    );
    // Only pay the Warden if this request is the one that spent the shield.
    if (rowCount) {
      await this.client.query(
        `UPDATE players SET shield_value = shield_value + $2
         WHERE handle_lower = (SELECT warden FROM shields WHERE id = $1)`,
        [id, value],
      );
    }
  }

  async insertShield(shield: Shield): Promise<void> {
    await this.client.query(
      `INSERT INTO shields (id, warden, target, placed_at, expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [shield.id, shield.warden.toLowerCase(), shield.target.toLowerCase(), shield.placedAt, shield.expiresAt],
    );
  }
}
