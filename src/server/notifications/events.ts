import { eq } from "drizzle-orm";
import { appointments, clients, services, type Appointment, type QuoteRequest } from "@/db/schema";
import type { DbLike } from "@/db/types";
import { formatDateLong, formatTime } from "@/lib/time";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings";
import { dispatchQueued, enqueueNotification, type QueuedNotification } from "./index";

/**
 * Eventos de domínio → mensagens. As funções `notify*` registram e enviam
 * (quando há provedor). Falhas de envio nunca desfazem a operação principal.
 */

async function apptContext(db: DbLike, appointmentId: string) {
  const [row] = await db
    .select({ appt: appointments, service: services, client: clients })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(eq(appointments.id, appointmentId));
  return row ?? null;
}

const when = (a: Appointment, tz: string) => `${formatDateLong(a.startsAt, tz)}, às ${formatTime(a.startsAt, tz)}`;

export type AppointmentEvent =
  | "received"
  | "confirmed"
  | "cancelled"
  | "rescheduled"
  | "reschedule_requested"
  | "reminder";

export async function notifyAppointment(
  db: DbLike,
  appointmentId: string,
  event: AppointmentEvent,
  opts: { accessToken?: string } = {},
) {
  try {
    const ctx = await apptContext(db, appointmentId);
    if (!ctx || !ctx.client) return;
    const { appt, service, client } = ctx;
    const [booking, studio, prefs] = await Promise.all([
      getSettings(db, "booking"),
      getSettings(db, "studio"),
      getSettings(db, "notifications"),
    ]);
    const tz = booking.timezone;
    const first = client.name.split(" ")[0];
    const lines: Record<AppointmentEvent, { subject: string; body: string }> = {
      received: {
        subject: `Recebemos sua solicitação — ${appt.protocol}`,
        body: `Olá, ${first}! Recebemos sua solicitação de ${service.name} para ${when(appt, tz)}.\n\nIMPORTANTE: o horário ainda NÃO está confirmado. O estúdio vai analisar e retornar em breve.\nProtocolo: ${appt.protocol}`,
      },
      confirmed: {
        subject: `Agendamento confirmado — ${appt.protocol}`,
        body: `Olá, ${first}! Seu agendamento de ${service.name} está confirmado para ${when(appt, tz)}.\nProtocolo: ${appt.protocol}${studio.cancellationPolicyText ? `\n\nPolítica de cancelamento: ${studio.cancellationPolicyText}` : ""}`,
      },
      cancelled: {
        subject: `Agendamento cancelado — ${appt.protocol}`,
        body: `Olá, ${first}. O agendamento de ${service.name} em ${when(appt, tz)} foi cancelado.${appt.cancelReason ? `\nMotivo: ${appt.cancelReason}` : ""}\nProtocolo: ${appt.protocol}`,
      },
      rescheduled: {
        subject: `Novo horário — ${appt.protocol}`,
        body: `Olá, ${first}! Seu agendamento de ${service.name} foi remarcado para ${when(appt, tz)}.\nProtocolo: ${appt.protocol}`,
      },
      reschedule_requested: {
        subject: `Pedido de reagendamento recebido — ${appt.protocol}`,
        body: `Olá, ${first}! Recebemos seu pedido para remarcar ${service.name} para ${when(appt, tz)}.\nO novo horário ainda precisa ser aprovado pelo estúdio. Até lá, o horário anterior continua valendo.`,
      },
      reminder: {
        subject: `Lembrete: sua sessão é em breve — ${appt.protocol}`,
        body: `Olá, ${first}! Lembrete da sua sessão de ${service.name} em ${when(appt, tz)}.${studio.address.showOnSite && studio.address.line1 ? `\nEndereço: ${studio.address.line1}${studio.address.city ? `, ${studio.address.city}` : ""}` : ""}`,
      },
    };
    const msg = lines[event];
    const stamp = event === "reminder" ? "" : `:${appt.status}:${appt.startsAt.getTime()}`;
    const queued: QueuedNotification[] = await enqueueNotification(db, {
      template: `appointment.${event}`,
      relatedType: "appointment",
      relatedId: appt.id,
      dedupeKey: `appt:${appt.id}:${event}${stamp}`,
      subject: msg.subject,
      body: msg.body,
      email: client.email,
      phone: client.phone,
      secretLink: opts.accessToken ? `${env.appUrl}/acompanhar/${opts.accessToken}` : undefined,
    });
    if ((event === "received" || event === "reschedule_requested") && prefs.notifyAdminOnNewRequests && prefs.adminEmail) {
      queued.push(
        ...(await enqueueNotification(db, {
          template: `admin.appointment.${event}`,
          relatedType: "appointment",
          relatedId: appt.id,
          dedupeKey: `admin:appt:${appt.id}:${event}:${appt.startsAt.getTime()}`,
          subject: `[Painel] ${event === "received" ? "Nova solicitação de agendamento" : "Pedido de reagendamento"} — ${appt.protocol}`,
          body: `${service.name} em ${when(appt, tz)}.\nAcesse o painel: ${env.appUrl}/admin/agenda/${appt.id}`,
          email: prefs.adminEmail,
          manualFallback: false,
        })),
      );
    }
    await dispatchQueued(db, queued);
  } catch (e) {
    console.error("[notifications] erro ao registrar notificação:", e instanceof Error ? e.message : e);
  }
}

export async function notifyQuote(
  db: DbLike,
  quote: QuoteRequest,
  event: "received" | "updated",
  opts: { accessToken?: string } = {},
) {
  try {
    if (!quote.clientId) return;
    const [client] = await db.select().from(clients).where(eq(clients.id, quote.clientId));
    if (!client) return;
    const prefs = await getSettings(db, "notifications");
    const first = client.name.split(" ")[0];
    const msg =
      event === "received"
        ? {
            subject: `Recebemos seu pedido de orçamento — ${quote.protocol}`,
            body: `Olá, ${first}! Recebemos sua ideia e vamos analisá-la com atenção. Você receberá um retorno pelo contato informado.\nProtocolo: ${quote.protocol}`,
          }
        : {
            subject: `Atualização do seu orçamento — ${quote.protocol}`,
            body: `Olá, ${first}! Há uma atualização no seu pedido de orçamento ${quote.protocol}.${quote.messageToClient ? `\n\nMensagem do estúdio:\n${quote.messageToClient}` : ""}`,
          };
    const queued = await enqueueNotification(db, {
      template: `quote.${event}`,
      relatedType: "quote",
      relatedId: quote.id,
      dedupeKey: `quote:${quote.id}:${event}:${quote.status}:${quote.updatedAt.getTime()}`,
      subject: msg.subject,
      body: msg.body,
      email: client.email,
      phone: client.phone,
      secretLink: opts.accessToken ? `${env.appUrl}/acompanhar/orcamento/${opts.accessToken}` : undefined,
    });
    if (event === "received" && prefs.notifyAdminOnNewRequests && prefs.adminEmail) {
      queued.push(
        ...(await enqueueNotification(db, {
          template: "admin.quote.received",
          relatedType: "quote",
          relatedId: quote.id,
          dedupeKey: `admin:quote:${quote.id}:received`,
          subject: `[Painel] Novo pedido de orçamento — ${quote.protocol}`,
          body: `Estilo: ${quote.style}\nLocal: ${quote.bodyPart}\nAcesse: ${env.appUrl}/admin/orcamentos/${quote.id}`,
          email: prefs.adminEmail,
          manualFallback: false,
        })),
      );
    }
    await dispatchQueued(db, queued);
  } catch (e) {
    console.error("[notifications] erro ao registrar notificação:", e instanceof Error ? e.message : e);
  }
}
