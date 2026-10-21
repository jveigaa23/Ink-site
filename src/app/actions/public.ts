"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { AppError } from "@/lib/errors";
import { bookingDetailsSchema, cancelByClientSchema, holdRequestSchema, lookupSchema, normalizePhone, quoteRequestSchema } from "@/lib/validation";
import { isNextControlFlow, toErrorState, type ActionState } from "@/server/action-result";
import {
  cancelByClient,
  confirmHold,
  createHold,
  releaseHold,
  rescheduleByClient,
} from "@/server/booking/service";
import { lookupByProtocol } from "@/server/lookup";
import { notifyAppointment, notifyQuote } from "@/server/notifications/events";
import { createQuote } from "@/server/quotes/service";
import { enforceRateLimit } from "@/server/rate-limit";
import { clientIpHash } from "@/server/request";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

/** Campo isca invisível + tempo mínimo de preenchimento: barreiras simples contra bots. */
function assertHuman(fd: FormData) {
  if (str(fd, "website")) throw new AppError("SPAM", "Não foi possível enviar.");
  const started = Number(str(fd, "startedAt"));
  if (started && Date.now() - started < 2500) throw new AppError("SPAM", "Envio muito rápido. Tente novamente.");
}

function contactFrom(fd: FormData) {
  return {
    name: str(fd, "name"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    privacyConsent: fd.get("privacyConsent") === "on",
  };
}

/* ------------------------------ Orçamento ----------------------------- */

export async function submitQuoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let token: string;
  try {
    assertHuman(fd);
    const db = getDb();
    await enforceRateLimit(db, `quote:${await clientIpHash()}`, 6, 3600);
    const input = quoteRequestSchema.parse({
      contact: contactFrom(fd),
      style: str(fd, "style"),
      bodyPart: str(fd, "bodyPart"),
      size: str(fd, "size"),
      description: str(fd, "description"),
      preferredDates: str(fd, "preferredDates"),
      extraInfo: str(fd, "extraInfo"),
    });
    const files = fd.getAll("references").filter((f): f is File => f instanceof File);
    const { quote, accessToken } = await createQuote(db, { input, files });
    await notifyQuote(db, quote, "received", { accessToken });
    token = accessToken;
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
  redirect(`/acompanhar/orcamento/${token}?novo=1`);
}

/* ----------------------------- Agendamento ---------------------------- */

export type HoldResult = ActionState<{ holdToken: string; expiresAt: string; startsAt: string; endsAt: string }>;

export async function holdSlotAction(input: { serviceId: string; startsAt: string }): Promise<HoldResult> {
  try {
    const db = getDb();
    const ipHash = await clientIpHash();
    await enforceRateLimit(db, `hold:${ipHash}`, 15, 600);
    const parsed = holdRequestSchema.parse(input);
    const hold = await createHold(db, { serviceId: parsed.serviceId, startsAt: new Date(parsed.startsAt), ipHash });
    return {
      status: "success",
      data: {
        holdToken: hold.holdToken,
        expiresAt: hold.holdExpiresAt.toISOString(),
        startsAt: hold.startsAt.toISOString(),
        endsAt: hold.endsAt.toISOString(),
      },
    };
  } catch (e) {
    return toErrorState(e);
  }
}

export async function releaseHoldAction(holdToken: string): Promise<void> {
  if (typeof holdToken === "string" && holdToken.length >= 20 && holdToken.length <= 100) {
    await releaseHold(getDb(), holdToken);
  }
}

export async function confirmBookingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let token: string;
  try {
    assertHuman(fd);
    const db = getDb();
    await enforceRateLimit(db, `confirm:${await clientIpHash()}`, 10, 600);
    const input = bookingDetailsSchema.parse({ holdToken: str(fd, "holdToken"), contact: contactFrom(fd), notes: str(fd, "notes") });
    const { appointment, created } = await confirmHold(db, { holdToken: input.holdToken, contact: input.contact, notes: input.notes });
    if (created) {
      await notifyAppointment(db, appointment.id, appointment.status === "confirmed" ? "confirmed" : "received", {
        accessToken: input.holdToken,
      });
    }
    token = input.holdToken;
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
  redirect(`/acompanhar/${token}?novo=1`);
}

/* ------------------------ Acompanhamento (cliente) ----------------------- */

export async function clientCancelAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const db = getDb();
    await enforceRateLimit(db, `client-change:${await clientIpHash()}`, 10, 600);
    const { reason } = cancelByClientSchema.parse({ reason: str(fd, "reason") });
    const appt = await cancelByClient(db, { token: str(fd, "token"), appointmentId: str(fd, "appointmentId"), reason });
    await notifyAppointment(db, appt.id, "cancelled");
    return { status: "success", message: "Agendamento cancelado. O horário foi liberado." };
  } catch (e) {
    return toErrorState(e);
  }
}

export async function clientRescheduleAction(input: { token: string; appointmentId: string; startsAt: string }): Promise<ActionState> {
  try {
    const db = getDb();
    await enforceRateLimit(db, `client-change:${await clientIpHash()}`, 10, 600);
    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new AppError("INVALID", "Horário inválido.");
    const r = await rescheduleByClient(db, { token: input.token, appointmentId: input.appointmentId, startsAt });
    await notifyAppointment(db, r.created.id, r.needsApproval ? "reschedule_requested" : "rescheduled");
    return {
      status: "success",
      message: r.needsApproval
        ? "Pedido de reagendamento enviado. O horário atual continua valendo até a aprovação do estúdio."
        : "Agendamento remarcado.",
    };
  } catch (e) {
    return toErrorState(e);
  }
}

export type LookupState = ActionState<Awaited<ReturnType<typeof lookupByProtocol>>>;

export async function lookupAction(_prev: LookupState, fd: FormData): Promise<LookupState> {
  try {
    const db = getDb();
    await enforceRateLimit(db, `lookup:${await clientIpHash()}`, 10, 900);
    const input = lookupSchema.parse({ protocol: str(fd, "protocol"), contact: str(fd, "contact") });
    const result = await lookupByProtocol(db, input.protocol, input.contact.includes("@") ? input.contact.trim().toLowerCase() : normalizePhone(input.contact));
    if (!result) {
      return { status: "error", message: "Não encontramos uma solicitação com esses dados. Confira o protocolo e o contato informado." };
    }
    return { status: "success", data: result };
  } catch (e) {
    return toErrorState(e);
  }
}

