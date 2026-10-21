import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../../src/db/create";
import { businessHours, portfolioCategories, services } from "../../src/db/schema";
import { createAdminUser } from "../../src/server/auth/core";
import { saveSettings } from "../../src/server/settings";
import { DEFAULT_BOOKING } from "../../src/config/settings-schema";

/** Prepara o banco E2E isolado: recria o schema, aplica migrações e dados mínimos de teste. */
async function main() {
  const url = process.env.DATABASE_URL!;
  if (!url || !/e2e/i.test(new URL(url).pathname)) throw new Error("DATABASE_URL do E2E deve apontar para um banco *_e2e.");
  const { db, sql } = createDb(url, { max: 1 });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await migrate(db, { migrationsFolder: "./drizzle" });
  await saveSettings(db, "booking", { ...DEFAULT_BOOKING, minNoticeHours: 0, slotStepMinutes: 60, maxAdvanceDays: 30 });
  await db.insert(businessHours).values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 8 * 60, endMinute: 22 * 60 })));
  await db.insert(services).values({ slug: "sessao-teste", name: "Sessão de teste", durationMinutes: 60, description: "Serviço de teste E2E." });
  await db.insert(portfolioCategories).values({ slug: "fineline", name: "Fineline" });
  await createAdminUser(db, { email: "admin@e2e.test", name: "Admin E2E", password: process.env.E2E_ADMIN_PASSWORD! });
  await sql.end();
  console.log("[e2e] banco preparado");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
