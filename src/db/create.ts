import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Cria um cliente Drizzle. `prepare: false` mantém compatibilidade com poolers em modo
 * transação (ex.: endpoint “-pooler” do Neon). Pool pequeno: cada função serverless
 * atende poucas requisições simultâneas.
 */
export function createDb(url: string, opts: { max?: number } = {}) {
  const sql = postgres(url, {
    max: opts.max ?? 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return { db: drizzle(sql, { schema }), sql };
}
