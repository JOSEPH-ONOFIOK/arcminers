import { FileStore } from "./file";
import { PostgresStore } from "./postgres";
import type { ShaftStore } from "./types";

export type * from "./types";

// The one place the app reaches for storage.
let store: ShaftStore | null = null;

export function getStore(): ShaftStore {
  if (store) return store;

  const url = process.env.DATABASE_URL;
  if (!url) {
    store = new FileStore(process.env.ARC_DB_PATH);
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
