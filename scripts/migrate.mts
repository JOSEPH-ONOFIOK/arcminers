// Apply the schema.

import { readFileSync } from "node:fs";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Nothing to migrate.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const sql = readFileSync(new URL("../src/lib/store/schema.sql", import.meta.url), "utf8");

await pool.query(sql);
await pool.end();
console.log("schema applied");
