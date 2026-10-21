import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { anonymizeInactiveClients } from "@/server/clients";
import { appointments, notifications } from "@/db/schema";
import type { DbLike } from "@/db/types";
import { sweepExpiredHolds } from "@/server/booking/service";
import { purgeExpiredSessions } from "@/server/auth/core";
import { notifyAppointment } from "@/server/notifications/events";
import { retryFailed } from "@/server/notifications";
import { purgeOldQuotes } from "@/server/quotes/service";
import { getSettings } from "@/server/settings";

/**
 * Rotina diária: expira reservas temporárias, envia lembretes, reprocessa e-mails
 * com falha, aplica retenção de dados e limpa sessões/limites antigos.
 * Idempotente: pode ser executada mais de uma vez sem duplicar lembretes.
 */
export async function runDailyMaintenance(db: DbLike, now = new Date()) {
  const [notif, privacy] = await Promise.all([getSettings(db, "notifications"), getSettings(db, "privacy")]);
  const expiredHolds = await sweepExpiredHolds(db, now);

  // Lembretes: sessões confirmadas na janela [agora, agora + antecedência + 24 h)
  // (a rotina roda 1x/dia; a janela extra garante cobertura entre execuções)
  const until = new Date(now.getTime() + (notif.reminderHoursBefore + 24) * 3_600_000);
  const due = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.status, "confirmed"), gte(appointments.startsAt, now), lt(appointments.startsAt, until)));
  const already = due.length
    ? await db
        .select({ relatedId: notifications.relatedId })
        .from(notifications)
        .where(and(eq(notifications.template, "appointment.reminder"), inArray(notifications.relatedId, due.map((d) => d.id))))
    : [];
  const done = new Set(already.map((a) => a.relatedId));
  let reminders = 0;
  for (const d of due) {
    if (done.has(d.id)) continue;
    await notifyAppointment(db, d.id, "reminder");
    reminders++;
  }

  const retried = await retryFailed(db);
  const cutoff = new Date(now.getTime() - privacy.quoteRetentionMonths * 30 * 86_400_000);
  const purgedQuotes = await purgeOldQuotes(db, cutoff);
  const clientCutoff = new Date(now.getTime() - privacy.clientRetentionMonths * 30 * 86_400_000);
  const anonymizedClients = await anonymizeInactiveClients(db, clientCutoff, now);
  await purgeExpiredSessions(db, now);
  await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  return { expiredHolds, reminders, retried, purgedQuotes, anonymizedClients };
}
