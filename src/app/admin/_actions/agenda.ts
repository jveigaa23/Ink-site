"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { AppError } from "@/lib/errors";
import { addDaysLocal, hhmmToMinutes, isValidLocalDate, parseLocalDateTime, zonedToUtc } from "@/lib/time";
import { env } from "@/server/env";
import { normalizePhone } from "@/lib/validation";
import { isNextControlFlow, toErrorState, type ActionState } from "@/server/action-result";
import { requireAdmin } from "@/server/auth/session";
import {
  adminCreateAppointment,
  adminReschedule,
  adminSetStatus,
  adminUpdateNotes,
  createBlock,
  deleteBlock,
} from "@/server/booking/service";
import { notifyAppointment } from "@/server/notifications/events";
import { getSettings } from "@/server/settings";
import { appointmentStatus } from "@/db/schema";

const actorOf = (admin: { id: string }) => ({ type: "admin" as const, id: admin.id });

const statusSchema = z.object({
  id: z.string().uuid(),
  to: z.enum(appointmentStatus.enumValues),
  reason: z.string().trim().max(500).optional(),
  notify: z.boolean(),
});

export async function setAppointmentStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const input = statusSchema.parse({ id: fd.get("id"), to: fd.get("to"), reason: fd.get("reason") ?? undefined, notify: fd.get("notify") === "on" });
    const db = getDb();
    const { after } = await adminSetStatus(db, { id: input.id, to: input.to, reason: input.reason, actor: actorOf(admin) });
    if (input.notify && (after.status === "confirmed" || after.status === "cancelled")) {
      await notifyAppointment(db, after.id, after.status === "confirmed" ? (after.rescheduledFromId ? "rescheduled" : "confirmed") : "cancelled");
    }
    return { status: "success", message: "Status atualizado." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}

const scheduleSchema = z.object({
  startsAt: z.string().min(10),
  durationMinutes: z.coerce.number().int().min(15, "Mínimo de 15 minutos.").max(720, "Máximo de 12 horas."),
  overrideRules: z.boolean(),
});

export async function rescheduleAppointmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const { timezone } = await getSettings(db, "booking");
    const id = z.string().uuid().parse(fd.get("id"));
    const input = scheduleSchema.parse({ startsAt: fd.get("startsAt"), durationMinutes: fd.get("durationMinutes"), overrideRules: fd.get("overrideRules") === "on" });
    const { after } = await adminReschedule(db, {
      id,
      startsAt: parseLocalDateTime(input.startsAt, timezone),
      durationMinutes: input.durationMinutes,
      overrideRules: input.overrideRules,
      actor: actorOf(admin),
    });
    if (fd.get("notify") === "on") await notifyAppointment(db, after.id, "rescheduled");
    return { status: "success", message: "Agendamento remarcado." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}

export async function updateAppointmentNotesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = z.string().uuid().parse(fd.get("id"));
    const internalNotes = z.string().trim().max(4000).parse(fd.get("internalNotes") ?? "");
    await adminUpdateNotes(getDb(), { id, internalNotes, depositReceived: fd.get("depositReceived") === "on", actor: actorOf(admin) });
    return { status: "success", message: "Anotações salvas." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}

const createSchema = z.object({
  serviceId: z.string().uuid("Selecione o serviço."),
  name: z.string().trim().min(2, "Informe o nome do cliente.").max(80),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("E-mail inválido.")]),
  phone: z.string().trim().transform(normalizePhone),
  status: z.enum(["pending", "confirmed"]),
  internalNotes: z.string().trim().max(4000),
});

export type CreateAppointmentState = ActionState<{ id: string; link: string }>;

export async function createAppointmentAction(_prev: CreateAppointmentState, fd: FormData): Promise<CreateAppointmentState> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const { timezone } = await getSettings(db, "booking");
    const base = createSchema.parse({
      serviceId: fd.get("serviceId"),
      name: fd.get("name"),
      email: fd.get("email") ?? "",
      phone: fd.get("phone") ?? "",
      status: fd.get("status"),
      internalNotes: fd.get("internalNotes") ?? "",
    });
    if (!base.email && !base.phone) throw new AppError("INVALID", "Informe e-mail ou telefone.", 400, { email: "Informe e-mail ou telefone." });
    const sched = scheduleSchema.parse({ startsAt: fd.get("startsAt"), durationMinutes: fd.get("durationMinutes"), overrideRules: fd.get("overrideRules") === "on" });
    const { appointment, accessToken } = await adminCreateAppointment(db, {
      serviceId: base.serviceId,
      contact: { name: base.name, email: base.email, phone: base.phone },
      startsAt: parseLocalDateTime(sched.startsAt, timezone),
      durationMinutes: sched.durationMinutes,
      overrideRules: sched.overrideRules,
      status: base.status,
      internalNotes: base.internalNotes,
      actor: actorOf(admin),
    });
    if (fd.get("notify") === "on") {
      await notifyAppointment(db, appointment.id, appointment.status === "confirmed" ? "confirmed" : "received", { accessToken });
    }
    return { status: "success", message: "Agendamento criado.", data: { id: appointment.id, link: `${env.appUrl}/acompanhar/${accessToken}` } };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}

export async function createBlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const { timezone } = await getSettings(db, "booking");
    const allDay = fd.get("allDay") === "on";
    const startDate = String(fd.get("startDate") ?? "");
    const endDate = String(fd.get("endDate") ?? "") || startDate;
    if (!isValidLocalDate(startDate) || !isValidLocalDate(endDate)) throw new AppError("INVALID", "Datas inválidas.");
    const startMin = allDay ? 0 : hhmmToMinutes(String(fd.get("startTime") ?? ""));
    const endMin = allDay ? 1440 : hhmmToMinutes(String(fd.get("endTime") ?? ""));
    if (startMin == null || endMin == null) throw new AppError("INVALID", "Horários inválidos.");
    const startsAt = zonedToUtc(startDate, startMin, timezone);
    // dia inteiro: até a meia-noite do dia seguinte ao último dia (no fuso do estúdio)
    const endsAt = allDay ? zonedToUtc(addDaysLocal(endDate, 1), 0, timezone) : zonedToUtc(endDate, endMin, timezone);
    const reason = z.string().trim().max(200).parse(fd.get("reason") ?? "");
    const { conflicts } = await createBlock(db, { startsAt, endsAt, reason, actor: actorOf(admin) });
    return {
      status: "success",
      message: conflicts.length
        ? `Bloqueio criado. Atenção: ${conflicts.length} agendamento(s) ativo(s) neste período — revise-os: ${conflicts.map((c) => c.protocol).join(", ")}.`
        : "Bloqueio criado.",
    };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}

export async function deleteBlockAction(fd: FormData) {
  const admin = await requireAdmin();
  await deleteBlock(getDb(), z.string().uuid().parse(fd.get("id")), actorOf(admin));
  redirect("/admin/bloqueios");
}
