import { and, eq, isNull, sql } from "drizzle-orm";
import { appointments, clients, quoteRequests, services } from "@/db/schema";
import type { DbLike } from "@/db/types";
import { getSettings } from "@/server/settings";
import { APPOINTMENT_STATUS_LABEL, QUOTE_STATUS_LABEL } from "@/domain/status";
import { formatDateLong, formatTime } from "@/lib/time";

/**
 * Consulta somente-leitura por protocolo + contato. Exige os dois para evitar enumeração
 * e retorna apenas o status — alterações exigem o link secreto.
 */
export async function lookupByProtocol(db: DbLike, protocol: string, contact: string) {
  const contactMatch = (clientId: unknown) =>
    sql`exists (select 1 from ${clients} c where c.id = ${clientId} and c.anonymized_at is null and (lower(c.email) = ${contact} or c.phone = ${contact}))`;

  if (protocol.startsWith("OR-")) {
    const [q] = await db
      .select({ protocol: quoteRequests.protocol, status: quoteRequests.status, createdAt: quoteRequests.createdAt })
      .from(quoteRequests)
      .where(and(eq(quoteRequests.protocol, protocol), contactMatch(quoteRequests.clientId)));
    if (!q) return null;
    return { kind: "quote" as const, protocol: q.protocol, statusLabel: QUOTE_STATUS_LABEL[q.status], detail: null };
  }
  const [a] = await db
    .select({ appt: appointments, serviceName: services.name })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.protocol, protocol), contactMatch(appointments.clientId), isNull(appointments.holdIpHash)));
  if (!a) return null;
  const { timezone } = await getSettings(db, "booking");
  return {
    kind: "appointment" as const,
    protocol: a.appt.protocol,
    statusLabel: APPOINTMENT_STATUS_LABEL[a.appt.status],
    detail: `${a.serviceName} — ${formatDateLong(a.appt.startsAt, timezone)}, ${formatTime(a.appt.startsAt, timezone)}`,
  };
}
