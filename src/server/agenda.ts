import { and, asc, desc, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { appointments, auditLog, availabilityBlocks, clients, notifications, quoteRequests, services, type AppointmentStatus } from "@/db/schema";
import type { DbLike } from "@/db/types";

const cols = {
  id: appointments.id,
  protocol: appointments.protocol,
  status: appointments.status,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  blockedUntil: appointments.blockedUntil,
  source: appointments.source,
  rescheduledFromId: appointments.rescheduledFromId,
  serviceId: appointments.serviceId,
  serviceName: services.name,
  clientName: clients.name,
};

export async function listAgenda(
  db: DbLike,
  params: { from: Date; to: Date; statuses?: AppointmentStatus[]; serviceId?: string },
) {
  const statuses = params.statuses?.length ? params.statuses : (["pending", "confirmed", "completed", "no_show"] as AppointmentStatus[]);
  const [appts, blocks] = await Promise.all([
    db
      .select(cols)
      .from(appointments)
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .leftJoin(clients, eq(clients.id, appointments.clientId))
      .where(
        and(
          inArray(appointments.status, statuses),
          lt(appointments.startsAt, params.to),
          gt(appointments.endsAt, params.from),
          params.serviceId ? eq(appointments.serviceId, params.serviceId) : undefined,
        ),
      )
      .orderBy(asc(appointments.startsAt)),
    db
      .select()
      .from(availabilityBlocks)
      .where(and(lt(availabilityBlocks.startsAt, params.to), gt(availabilityBlocks.endsAt, params.from)))
      .orderBy(asc(availabilityBlocks.startsAt)),
  ]);
  return { appts, blocks };
}

export async function listAgendaPage(
  db: DbLike,
  params: { from: Date; statuses?: AppointmentStatus[]; serviceId?: string; page: number; pageSize?: number },
) {
  const pageSize = params.pageSize ?? 25;
  const rows = await db
    .select(cols)
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        inArray(appointments.status, params.statuses?.length ? params.statuses : ["pending", "confirmed"]),
        gte(appointments.startsAt, params.from),
        params.serviceId ? eq(appointments.serviceId, params.serviceId) : undefined,
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(pageSize + 1)
    .offset((params.page - 1) * pageSize);
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function getAppointmentDetail(db: DbLike, id: string) {
  const [row] = await db
    .select({ appt: appointments, service: services, client: clients })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(eq(appointments.id, id));
  if (!row) return null;
  const [history, notifs, related, quote] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, "appointment"), eq(auditLog.entityId, id)))
      .orderBy(desc(auditLog.createdAt))
      .limit(50),
    db.select().from(notifications).where(and(eq(notifications.relatedType, "appointment"), eq(notifications.relatedId, id))).orderBy(desc(notifications.createdAt)),
    db
      .select({ id: appointments.id, protocol: appointments.protocol, status: appointments.status, startsAt: appointments.startsAt, rescheduledFromId: appointments.rescheduledFromId })
      .from(appointments)
      .where(
        row.appt.rescheduledFromId
          ? inArray(appointments.id, [row.appt.rescheduledFromId])
          : eq(appointments.rescheduledFromId, id),
      ),
    row.appt.quoteId
      ? db.select({ id: quoteRequests.id, protocol: quoteRequests.protocol }).from(quoteRequests).where(eq(quoteRequests.id, row.appt.quoteId))
      : Promise.resolve([]),
  ]);
  return { ...row, history, notifs, related, quote: quote[0] ?? null };
}
