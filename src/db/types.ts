import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

/** Aceita tanto a conexão quanto uma transação em andamento. */
export type DbLike = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;
