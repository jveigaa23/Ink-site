import { and, desc, eq, gt, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { appointments, clients, quoteReferences, quoteRequests, services } from "@/db/schema";
import type { DbLike } from "@/db/types";
import type { ContactInput } from "@/lib/validation";
import { AppError } from "@/lib/errors";
import { audit, type Actor } from "@/server/audit";
import { deleteObject } from "@/server/storage";

/**
 * Encontra o cliente pelo e-mail ou telefone, ou cria um novo registro.
 * Não sobrescreve dados existentes com valores enviados por terceiros; apenas completa lacunas.
 */
export async function upsertClientFromContact(db: DbLike, contact: ContactInput, consentAt: Date | null) {
  const email = contact.email || null;
  const phone = contact.phone || null;
  const conditions = [];
  if (email) conditions.push(sql`lower(${clients.email}) = ${email.toLowerCase()}`);
  if (phone) conditions.push(eq(clients.phone, phone));

  if (conditions.length) {
    const [existing] = await db
      .select()
      .from(clients)
      .where(and(or(...conditions), isNull(clients.anonymizedAt)))
      .orderBy(desc(clients.createdAt))
      .limit(1);
    if (existing) {
      const patch: Partial<typeof clients.$inferInsert> = {};
      if (!existing.email && email) patch.email = email;
      if (!existing.phone && phone) patch.phone = phone;
      if (consentAt) patch.privacyConsentAt = consentAt;
      if (Object.keys(patch).length) await db.update(clients).set(patch).where(eq(clients.id, existing.id));
      return existing;
    }
  }
  const [created] = await db
    .insert(clients)
    .values({ name: contact.name, email, phone, privacyConsentAt: consentAt })
    .returning();
  return created;
}

export async function listClients(db: DbLike, params: { q?: string; page: number; pageSize?: number }) {
  const pageSize = params.pageSize ?? 25;
  const q = params.q?.trim();
  const where = and(
    isNull(clients.anonymizedAt),
    q
      ? or(ilike(clients.name, `%${q}%`), ilike(clients.email, `%${q}%`), ilike(clients.phone, `%${q.replace(/\D/g, "") || q}%`))
      : undefined,
  );
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      email: clients.email,
      phone: clients.phone,
      createdAt: clients.createdAt,
      appointments: sql<number>`(select count(*)::int from ${appointments} a where a.client_id = ${clients.id} and a.status in ('pending','confirmed','completed'))`,
      quotes: sql<number>`(select count(*)::int from ${quoteRequests} q where q.client_id = ${clients.id})`,
    })
    .from(clients)
    .where(where)
    .orderBy(desc(clients.createdAt))
    .limit(pageSize + 1)
    .offset((params.page - 1) * pageSize);
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function getClientDetail(db: DbLike, id: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  if (!client) return null;
  const [appts, quotes] = await Promise.all([
    db
      .select({ appt: appointments, serviceName: services.name })
      .from(appointments)
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .where(eq(appointments.clientId, id))
      .orderBy(desc(appointments.startsAt)),
    db.select().from(quoteRequests).where(eq(quoteRequests.clientId, id)).orderBy(desc(quoteRequests.createdAt)),
  ]);
  return { client, appointments: appts, quotes };
}

export async function updateClientNotes(db: DbLike, id: string, internalNotes: string, actor: Actor) {
  await db.update(clients).set({ internalNotes: internalNotes || null }).where(eq(clients.id, id));
  await audit(db, actor, "client.notes", { type: "client", id });
}

/**
 * Atende pedidos de exclusão (LGPD): remove dados de contato, observações e referências
 * enviadas, preservando apenas registros mínimos de agenda sem identificação pessoal.
 */
export async function anonymizeClient(db: DbLike, id: string, actor: Actor, now = new Date()) {
  const keys = await db.transaction(async (tx) => {
    const [client] = await tx.select().from(clients).where(eq(clients.id, id)).for("update");
    if (!client) throw new AppError("NOT_FOUND", "Cliente não encontrado.", 404);
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(eq(appointments.clientId, id), inArray(appointments.status, ["pending", "confirmed"]), gt(appointments.startsAt, now)));
    if (n > 0) {
      throw new AppError("HAS_FUTURE", "Cancele os agendamentos futuros deste cliente antes de excluir os dados.", 409);
    }
    const refs = await tx
      .select({ key: quoteReferences.storageKey })
      .from(quoteReferences)
      .innerJoin(quoteRequests, eq(quoteRequests.id, quoteReferences.quoteId))
      .where(eq(quoteRequests.clientId, id));
    await tx.execute(sql`delete from quote_references using quote_requests
      where quote_references.quote_id = quote_requests.id and quote_requests.client_id = ${id}`);
    await tx
      .update(quoteRequests)
      .set({ description: "[removido a pedido do titular]", extraInfo: null, preferredDates: null, internalNotes: null })
      .where(eq(quoteRequests.clientId, id));
    await tx
      .update(appointments)
      .set({ clientNotes: null, internalNotes: null })
      .where(eq(appointments.clientId, id));
    await tx
      .update(clients)
      .set({ name: "Cliente removido", email: null, phone: null, internalNotes: null, anonymizedAt: now })
      .where(eq(clients.id, id));
    await audit(tx, actor, "client.anonymized", { type: "client", id });
    return refs.map((r) => r.key);
  });
  await Promise.allSettled(keys.map((k) => deleteObject(k, "private")));
}
