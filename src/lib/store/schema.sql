-- The Proving Shaft.

CREATE TABLE IF NOT EXISTS players (
  handle_lower  TEXT PRIMARY KEY,
  handle        TEXT NOT NULL,
  rig           TEXT NOT NULL,
-- The single clock picks accrue against.
  started_at    BIGINT NOT NULL,
  picks_spent   INTEGER NOT NULL DEFAULT 0,
  tier          TEXT NOT NULL DEFAULT 'surface',
  tier_since    BIGINT NOT NULL,
  deepest_tier  TEXT NOT NULL DEFAULT 'surface',
  ore_banked    BIGINT NOT NULL DEFAULT 0,
  ore_loose     BIGINT NOT NULL DEFAULT 0,
  fault_pp      DOUBLE PRECISION NOT NULL DEFAULT 0,
  digs          INTEGER NOT NULL DEFAULT 0,
  cave_ins      INTEGER NOT NULL DEFAULT 0,
  saved         INTEGER NOT NULL DEFAULT 0,
  shield_value  BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS digs (
  id            TEXT PRIMARY KEY,
  handle_lower  TEXT NOT NULL REFERENCES players(handle_lower) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,
  tier          TEXT NOT NULL,
  committed_at  BIGINT NOT NULL,
  reveal_at     BIGINT NOT NULL,
  revealed_at   BIGINT,
  patch         TEXT,
  ore           INTEGER NOT NULL DEFAULT 0,
  cave_in       BOOLEAN NOT NULL DEFAULT FALSE,
  shielded      BOOLEAN NOT NULL DEFAULT FALSE,
  odds          DOUBLE PRECISION NOT NULL DEFAULT 0
);

-- One dig per player per sequence number.
CREATE UNIQUE INDEX IF NOT EXISTS digs_seq_idx ON digs (handle_lower, seq);
CREATE INDEX IF NOT EXISTS digs_log_idx ON digs (handle_lower, seq DESC);

-- Seams are per UTC day and per tier, shared by the whole field.
CREATE TABLE IF NOT EXISTS seams (
  day        TEXT NOT NULL,
  tier       TEXT NOT NULL,
  total      BIGINT NOT NULL,
  remaining  BIGINT NOT NULL,
  PRIMARY KEY (day, tier)
);

CREATE TABLE IF NOT EXISTS shields (
  id           TEXT PRIMARY KEY,
  warden       TEXT NOT NULL,
  target       TEXT NOT NULL,
  placed_at    BIGINT NOT NULL,
  expires_at   BIGINT NOT NULL,
  consumed_by  TEXT
);

-- The lookup every dig at depth performs:
CREATE INDEX IF NOT EXISTS shields_cover_idx ON shields (target, expires_at) WHERE consumed_by IS NULL;
CREATE INDEX IF NOT EXISTS shields_warden_idx ON shields (warden);

-- A Warden cannot stack shields on the same player:
CREATE UNIQUE INDEX IF NOT EXISTS shields_one_live_idx
  ON shields (warden, target) WHERE consumed_by IS NULL;

CREATE TABLE IF NOT EXISTS entries (
  handle_lower  TEXT PRIMARY KEY,
  handle        TEXT NOT NULL,
  dig_tag       TEXT NOT NULL UNIQUE,
  seed          BIGINT NOT NULL,
  rig           TEXT NOT NULL,
  tier          TEXT NOT NULL,
  traits        JSONB NOT NULL,
  rarity        DOUBLE PRECISION NOT NULL,
  post_id       TEXT NOT NULL,
  verified_at   BIGINT NOT NULL
);

-- Likes are rows, not a counter:
CREATE TABLE IF NOT EXISTS votes (
  entry_handle  TEXT NOT NULL REFERENCES entries(handle_lower) ON DELETE CASCADE,
  voter_id      TEXT NOT NULL,
  PRIMARY KEY (entry_handle, voter_id)
);

CREATE INDEX IF NOT EXISTS votes_voter_idx ON votes (voter_id);

CREATE TABLE IF NOT EXISTS claims (
  handle_lower  TEXT PRIMARY KEY,
  handle        TEXT NOT NULL,
  wallet        TEXT NOT NULL,
  sigil         TEXT NOT NULL UNIQUE,
  position      INTEGER NOT NULL,
  joined_at     BIGINT NOT NULL
);

-- One spot per wallet.
CREATE UNIQUE INDEX IF NOT EXISTS claims_wallet_idx ON claims (lower(wallet));
