import type { AppointmentStatus, QuoteStatus } from "@/db/schema";

/* ---------------------------- Orçamentos ---------------------------- */

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  received: "Recebida",
  in_review: "Em análise",
  awaiting_client: "Aguardando resposta do cliente",
  approved: "Aprovada",
  declined: "Recusada",
  archived: "Arquivada",
};

const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  received: ["in_review", "awaiting_client", "approved", "declined", "archived"],
  in_review: ["awaiting_client", "approved", "declined", "archived"],
  awaiting_client: ["in_review", "approved", "declined", "archived"],
  approved: ["awaiting_client", "archived"],
  declined: ["in_review", "archived"],
  archived: ["in_review"],
};

export const canTransitionQuote = (from: QuoteStatus, to: QuoteStatus) =>
  QUOTE_TRANSITIONS[from].includes(to);

export const nextQuoteStatuses = (from: QuoteStatus) => QUOTE_TRANSITIONS[from];

/* --------------------------- Agendamentos --------------------------- */

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  held: "Horário reservado temporariamente",
  pending: "Solicitação recebida — aguardando confirmação",
  confirmed: "Agendamento confirmado",
  completed: "Sessão concluída",
  cancelled: "Agendamento cancelado",
  no_show: "Não compareceu",
  expired: "Reserva expirada",
};

export const APPOINTMENT_STATUS_SHORT: Record<AppointmentStatus, string> = {
  held: "Reserva temporária",
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  expired: "Expirado",
};

/** Status que ocupam a agenda (também definidos na restrição de exclusão do banco). */
export const ACTIVE_STATUSES: AppointmentStatus[] = ["held", "pending", "confirmed"];

const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  held: ["pending", "confirmed", "expired", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: ["completed"],
  expired: ["pending", "confirmed"], // somente pela confirmação do próprio cliente, se o horário seguir livre
};

export const canTransitionAppointment = (from: AppointmentStatus, to: AppointmentStatus) =>
  APPOINTMENT_TRANSITIONS[from].includes(to);

/* --------------------- Políticas de cancelamento --------------------- */

export type ClientPolicy = {
  allowClientCancel: boolean;
  allowClientReschedule: boolean;
  cancellationNoticeHours: number;
};

export type PolicyDecision = { allowed: true } | { allowed: false; reason: string };

/** Decide se o cliente pode cancelar/reagendar online. O estúdio sempre pode pelo painel. */
export function clientChangeDecision(
  kind: "cancel" | "reschedule",
  appt: { status: AppointmentStatus; startsAt: Date },
  policy: ClientPolicy,
  now: Date,
): PolicyDecision {
  if (kind === "cancel" && !policy.allowClientCancel)
    return { allowed: false, reason: "Cancelamentos online não estão habilitados. Fale com o estúdio." };
  if (kind === "reschedule" && !policy.allowClientReschedule)
    return { allowed: false, reason: "Reagendamentos online não estão habilitados. Fale com o estúdio." };
  if (appt.status !== "pending" && appt.status !== "confirmed")
    return { allowed: false, reason: "Este agendamento não pode mais ser alterado." };
  const limit = appt.startsAt.getTime() - policy.cancellationNoticeHours * 3_600_000;
  if (now.getTime() > limit)
    return {
      allowed: false,
      reason: `Alterações online são permitidas até ${policy.cancellationNoticeHours} h antes da sessão. Fale com o estúdio.`,
    };
  return { allowed: true };
}
