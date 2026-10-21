"use server";

import { z } from "zod";
import { getDb } from "@/db/client";
import { quoteStatus } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { parseMoneyToCents } from "@/lib/money";
import { parseLocalDateTime } from "@/lib/time";
import { isNextControlFlow, toErrorState, type ActionState } from "@/server/action-result";
import { requireAdmin } from "@/server/auth/session";
import { notifyAppointment, notifyQuote } from "@/server/notifications/events";
import { adminUpdateQuote, convertQuoteToAppointment } from "@/server/quotes/service";
import { getSettings } from "@/server/settings";

function money(v: FormDataEntryValue | null, field: string) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const c = parseMoneyToCents(s);
  if (c == null) throw new AppError("INVALID", "Valor inválido.", 400, { [field]: "Use o formato 1.250,00." });
  return c;
}

export async function updateQuoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const { timezone } = await getSettings(db, "booking");
    const id = z.string().uuid().parse(fd.get("id"));
    const status = z.enum(quoteStatus.enumValues).parse(fd.get("status"));
    const slots = fd
      .getAll("proposedSlot")
      .map(String)
      .filter(Boolean)
      .slice(0, 5)
      .map((v) => ({ startsAt: parseLocalDateTime(v, timezone).toISOString() }));
    const { after, clientVisibleChange } = await adminUpdateQuote(db, {
      id,
      status,
      estimateMinCents: money(fd.get("estimateMin"), "estimateMin"),
      estimateMaxCents: money(fd.get("estimateMax"), "estimateMax"),
      messageToClient: z.string().trim().max(3000).parse(fd.get("messageToClient") ?? ""),
      internalNotes: z.string().trim().max(4000).parse(fd.get("internalNotes") ?? ""),
      proposedSlots: slots,
      actor: { type: "admin", id: admin.id },
    });
    if (clientVisibleChange && fd.get("notify") === "on") await notifyQuote(db, after, "updated");
    return { status: "success", message: "Orçamento atualizado." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}

export async function convertQuoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const { timezone } = await getSettings(db, "booking");
    const input = z
      .object({
        quoteId: z.string().uuid(),
        serviceId: z.string().uuid("Selecione o serviço."),
        startsAt: z.string(),
        durationMinutes: z.coerce.number().int().min(15).max(720),
        status: z.enum(["pending", "confirmed"]),
      })
      .parse(Object.fromEntries(fd));
    const { appointment } = await convertQuoteToAppointment(db, {
      ...input,
      startsAt: parseLocalDateTime(input.startsAt, timezone),
      overrideRules: fd.get("overrideRules") === "on",
      actor: { type: "admin", id: admin.id },
    });
    if (fd.get("notify") === "on") await notifyAppointment(db, appointment.id, appointment.status === "confirmed" ? "confirmed" : "received");
    return { status: "success", message: "Agendamento criado a partir do orçamento." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}
