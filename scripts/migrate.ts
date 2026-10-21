import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../src/db/create";

/**
 * Aplica as migrações versionadas em ./drizzle.
 * Em builds da Vercel, só executa quando VERCEL_ENV=production ou MIGRATE_ON_BUILD=1,
 * para que deploys de preview não alterem o banco de produção.
 */
async function main() {
  const fromBuild = process.argv.includes("--from-build");
  if (fromBuild) {
    const allowed = process.env.VERCEL_ENV === "production" || process.env.MIGRATE_ON_BUILD === "1";
    if (!allowed) {
      console.log("[migrate] ignorado neste build (defina MIGRATE_ON_BUILD=1 para forçar).");
      return;
    }
  }
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  const { db, sql } = createDb(url, { max: 1 });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await sql.end();
  console.log("[migrate] migrações aplicadas.");
}

main().catch((err) => {
  console.error("[migrate] falhou:", err instanceof Error ? err.message : err);
  process.exit(1);
});
