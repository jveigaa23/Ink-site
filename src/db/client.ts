import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { createDb } from "./create";

export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: { db: Db; sql: postgres.Sql } };

function init() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  return createDb(url);
}

/** Conexão compartilhada pelo processo (reaproveitada entre invocações serverless “quentes”). */
export function getDb(): Db {
  globalForDb.__db ??= init();
  return globalForDb.__db.db;
}

