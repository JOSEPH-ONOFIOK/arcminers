import { FileStore } from "./file";
import { MemoryStore } from "./memory";
import { PostgresStore } from "./postgres";
import type { ShaftStore } from "./types";

export type * from "./types";

// The one place the app reaches for storage.
let store: ShaftStore | null = null;

export function getStore(): ShaftStore {
  if (store) return store;

  const url = process.env.DATABASE_URL;
  if (!url) {
    store = writableStore();
    return store;
  }

  // Required at call time rather than imported at module scope, so a deploy
  // without a database never pays for a driver it will not use.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  store = new PostgresStore(
    new Pool({
      connectionString: url,
      // Serverless instances are many and short-lived. Keep each footprint
      // small and let the provider's pooler multiplex, point DATABASE_URL at
      // the *pooled* connection string.
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    }),
  );
  return store;
}

// Which store is live. Anything but postgres is a demo: the file store is one machine's
// disk, and the memory store is one instance's heap.
export function storageKind(): "postgres" | "file" | "memory" {
  if (process.env.DATABASE_URL) return "postgres";
  return getStore() instanceof MemoryStore ? "memory" : "file";
}

// True when nothing being written will outlive the process. The shaft says so on the page,
// because a run that vanishes between two clicks is otherwise indistinguishable from a bug.
export function storageEphemeral(): boolean {
  return storageKind() !== "postgres";
}

// Pick a store that can actually accept a write.
//
// The file store is the better fallback when there is a disk, since a restart keeps the
// data. On a serverless filesystem there is no disk to have, and the alternative to memory
// is a deployment that cannot enlist anybody. Probing beats guessing from an env var: the
// question is not which host this is, it is whether this path takes a write.
function writableStore(): ShaftStore {
  if (process.env.ARC_EPHEMERAL === "1") return new MemoryStore();

  const path = process.env.ARC_DB_PATH ?? ".data/shaft.json";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mkdirSync, writeFileSync, rmSync } = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dirname, join } = require("node:path") as typeof import("node:path");
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, ".writable");
    writeFileSync(probe, "");
    rmSync(probe, { force: true });
    return new FileStore(path);
  } catch {
    console.warn(
      "[shaft] no DATABASE_URL and no writable filesystem. Falling back to memory: state will " +
        "not survive a cold start. Set DATABASE_URL before the window opens.",
    );
    return new MemoryStore();
  }
}
