import { sql } from "drizzle-orm";
import type { DbLike } from "@/db/types";
import { AppError } from "@/lib/errors";

/**
 * Limitação de requisições por janela fixa, persistida no PostgreSQL.
 * Funciona entre instâncias serverless (memória local não seria confiável).
 */
export async function hitRateLimit(
  db: DbLike,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number }> {
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   then now() else rate_limits.window_start end
    returning count
  `);
  const count = Number(rows[0]?.count ?? 1);
  return { allowed: count <= limit, count };
}

export async function enforceRateLimit(db: DbLike, key: string, limit: number, windowSeconds: number) {
  const { allowed } = await hitRateLimit(db, key, limit, windowSeconds);
  if (!allowed) {
    throw new AppError("RATE_LIMITED", "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.", 429);
  }
}

export async function resetRateLimit(db: DbLike, key: string) {
  await db.execute(sql`delete from rate_limits where key = ${key}`);
}
