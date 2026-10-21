import { asc, eq, sql } from "drizzle-orm";
import { appointments, businessHours, services } from "@/db/schema";
import type { DbLike } from "@/db/types";
import { AppError, PG_UNIQUE_VIOLATION, pgErrorCode } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { audit, type Actor } from "@/server/audit";

export async function listServices(db: DbLike, opts: { onlyActive?: boolean } = {}) {
  const rows = await db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));
  return opts.onlyActive ? rows.filter((s) => s.active) : rows;
}

export type ServiceFields = {
  name: string;
  description: string;
  durationMinutes: number;
  priceType: "on_request" | "from" | "fixed";
  priceCents: number | null;
  bookableOnline: boolean;
  active: boolean;
  sortOrder: number;
};

export async function saveService(db: DbLike, params: { id?: string; fields: ServiceFields; actor: Actor }) {
  const f = params.fields;
  if (f.priceType !== "on_request" && f.priceCents == null) {
    throw new AppError("INVALID", "Informe o valor ou selecione “sob avaliação”.", 400, { priceCents: "Informe o valor." });
  }
  const values = { ...f, priceCents: f.priceType === "on_request" ? null : f.priceCents, slug: slugify(f.name) };
  try {
    if (params.id) {
      await db.update(services).set(values).where(eq(services.id, params.id));
      await audit(db, params.actor, "service.updated", { type: "service", id: params.id });
      return params.id;
    }
    const [row] = await db.insert(services).values(values).returning({ id: services.id });
    await audit(db, params.actor, "service.created", { type: "service", id: row.id });
    return row.id;
  } catch (e) {
    if (pgErrorCode(e) === PG_UNIQUE_VIOLATION) throw new AppError("DUPLICATE", "Já existe um serviço com esse nome.");
    throw e;
  }
}

/** Serviços com histórico não podem ser excluídos; apenas desativados. */
export async function deleteService(db: DbLike, id: string, actor: Actor) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(eq(appointments.serviceId, id));
  if (n > 0) throw new AppError("IN_USE", "Este serviço possui agendamentos. Desative-o em vez de excluir.", 409);
  await db.delete(services).where(eq(services.id, id));
  await audit(db, actor, "service.deleted", { type: "service", id });
}

export async function getBusinessHours(db: DbLike) {
  return db.select().from(businessHours).orderBy(asc(businessHours.weekday), asc(businessHours.startMinute));
}

export type HoursInput = { weekday: number; startMinute: number; endMinute: number }[];

export function validateHours(hours: HoursInput) {
  for (const h of hours) {
    if (h.weekday < 0 || h.weekday > 6 || h.startMinute < 0 || h.endMinute > 1440 || h.startMinute >= h.endMinute) {
      throw new AppError("INVALID", "Há um intervalo de horário inválido.");
    }
  }
  for (let d = 0; d < 7; d++) {
    const day = hours.filter((h) => h.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < day.length; i++) {
      if (day[i].startMinute < day[i - 1].endMinute) {
        throw new AppError("INVALID", "Há intervalos sobrepostos no mesmo dia.");
      }
    }
  }
}

export async function replaceBusinessHours(db: DbLike, hours: HoursInput, actor: Actor) {
  validateHours(hours);
  await db.transaction(async (tx) => {
    await tx.delete(businessHours);
    if (hours.length) await tx.insert(businessHours).values(hours);
    await audit(tx, actor, "hours.updated", { type: "settings", id: "business_hours" }, { intervals: hours.length });
  });
}
