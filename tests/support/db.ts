import { sql } from "drizzle-orm";
import { afterAll } from "vitest";
import { createDb } from "../../src/db/create";
import { businessHours, services } from "../../src/db/schema";
import { saveSettings } from "../../src/server/settings";
import { DEFAULT_BOOKING, type BookingSettings } from "../../src/config/settings-schema";
import { loadTestEnv } from "./env";

const url = loadTestEnv();
export const hasDb = Boolean(url);

const conn = url ? createDb(url, { max: 10 }) : null;
export const db = conn?.db as NonNullable<typeof conn>["db"];

afterAll(async () => {
  await conn?.sql.end();
});

export async function resetDb() {
  await db.execute(sql`truncate table
    audit_log, notifications, quote_references, appointments, quote_requests, clients,
    services, business_hours, availability_blocks, portfolio_items, portfolio_categories,
    settings, rate_limits, admin_sessions, admin_users restart identity cascade`);
}

/** Estúdio padrão de teste: seg–sex 10h–18h (America/Sao_Paulo), passo 60 min, preparo 30 min. */
export async function seedStudio(overrides: Partial<BookingSettings> = {}) {
  await saveSettings(db, "booking", {
    ...DEFAULT_BOOKING,
    slotStepMinutes: 60,
    bufferMinutes: 30,
    minNoticeHours: 0,
    maxAdvanceDays: 60,
    ...overrides,
  });
  await db.insert(businessHours).values(
    [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 600, endMinute: 1080 })),
  );
  const [svc] = await db
    .insert(services)
    .values({ slug: "sessao-2h", name: "Sessão 2h", durationMinutes: 120, bookableOnline: true })
    .returning();
  return svc;
}
