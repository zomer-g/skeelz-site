import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { logError } from "@/lib/log";

export type Db = NodePgDatabase<typeof schema>;

// One pool per process; kept on globalThis so `next dev` reloads don't leak pools.
const g = globalThis as unknown as { __skeelzSiteDb?: Db; __skeelzSitePool?: Pool };

/** Created lazily: the build imports this module but must never connect. */
export function getPool(): Pool {
  if (!g.__skeelzSitePool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.__skeelzSitePool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
    g.__skeelzSitePool.on("error", (err) => logError("db: idle client", err));
  }
  return g.__skeelzSitePool;
}

export function getDb(): Db {
  g.__skeelzSiteDb ??= drizzle(getPool(), { schema });
  return g.__skeelzSiteDb;
}
