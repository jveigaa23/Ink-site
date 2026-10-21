import { and, asc, eq, gt, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import {
  appointments,
  availabilityBlocks,
  businessHours,
  clients,
  services,
  type Appointment,
  type AppointmentStatus,
} from "@/db/schema";
import type { DbLike } from "@/db/types";
import { computeSlots, dayWindowReason, findSlot, type Interval } from "@/domain/availability";
import { ACTIVE_STATUSES, canTransitionAppointment, clientChangeDecision } from "@/domain/status";
import { generateProtocol, generateToken, sha256 } from "@/lib/crypto";
import { AppError, PG_EXCLUSION_VIOLATION, pgErrorCode } from "@/lib/errors";
import { addDaysLocal, startOfLocalDay, toLocalDate, type LocalDate } from "@/lib/time";
import type { ContactInput } from "@/lib/validation";
import { audit, CLIENT, type Actor } from "@/server/audit";
import { upsertClientFromContact } from "@/server/clients";
import { getSettings } from "@/server/settings";
import type { BookingSettings } from "@/config/settings-schema";

/** Chave do lock transacional que serializa alterações de agenda. */
const SCHEDULE_LOCK_KEY = 72_410_001;

const MAX_ACTIVE_HOLDS_PER_IP = 3;

export const slotUnavailable = () =>
  new AppError("SLOT_UNAVAILABLE", "Este horário acabou de ficar indisponível. Escolha outro horário.", 409);

async function lockSchedule(tx: DbLike) {
  await tx.execute(sql`select pg_advisory_xact_lock(${SCHEDULE_LOCK_KEY})`);
}

/** Executa a função dentro de uma transação com lock de agenda e converte violações de exclusão. */
async function withScheduleLock<T>(db: DbLike, fn: (tx: DbLike) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      await lockSchedule(tx);
      return fn(tx);
    });
  } catch (e) {
    if (pgErrorCode(e) === PG_EXCLUSION_VIOLATION) throw slotUnavailable();
    throw e;
  }
}

async function expireStaleHolds(tx: DbLike, now: Date) {
  await tx
    .update(appointments)
    .set({ status: "expired" })
    .where(and(eq(appointments.status, "held"), lte(appointments.holdExpiresAt, now)));
}

function rulesOf(s: BookingSettings) {
  return {
    timezone: s.timezone,
    slotStepMinutes: s.slotStepMinutes,
    bufferMinutes: s.bufferMinutes,
    minNoticeHours: s.minNoticeHours,
    maxAdvanceDays: s.maxAdvanceDays,
  };
}

/** Carrega expediente e intervalos ocupados que podem afetar a data informada. */
export async function loadDayContext(
  db: DbLike,
  date: LocalDate,
  timezone: string,
  now: Date,
  excludeIds: string[] = [],
) {
  const from = startOfLocalDay(addDaysLocal(date, -1), timezone);
  const to = startOfLocalDay(addDaysLocal(date, 2), timezone);

  const [hours, appts, blocks] = await Promise.all([
    db.select().from(businessHours),
    db
      .select({ id: appointments.id, start: appointments.startsAt, end: appointments.blockedUntil })
      .from(appointments)
      .where(
        and(
          inArray(appointments.status, ACTIVE_STATUSES),
          lt(appointments.startsAt, to),
          gt(appointments.blockedUntil, from),
          // reservas temporárias vencidas não ocupam a agenda
          or(ne(appointments.status, "held"), gt(appointments.holdExpiresAt, now)),
        ),
      ),
    db
      .select({ start: availabilityBlocks.startsAt, end: availabilityBlocks.endsAt })
      .from(availabilityBlocks)
      .where(and(lt(availabilityBlocks.startsAt, to), gt(availabilityBlocks.endsAt, from))),
  ]);

  const busy: Interval[] = [
    ...appts.filter((a) => !excludeIds.includes(a.id)).map((a) => ({ start: a.start, end: a.end })),
    ...blocks,
  ];
  return { hours, busy };
}

async function getBookableService(db: DbLike, serviceId: string) {
  const [svc] = await db.select().from(services).where(eq(services.id, serviceId));
  if (!svc || !svc.active || !svc.bookableOnline) {
    throw new AppError("SERVICE_UNAVAILABLE", "Este serviço não está disponível para agendamento online.", 404);
  }
  return svc;
}

/* ------------------------------------------------------------------ */
/* Consulta pública de disponibilidade                                 */
/* ------------------------------------------------------------------ */

export async function getAvailability(db: DbLike, params: { serviceId: string; date: LocalDate; now?: Date }) {
  const now = params.now ?? new Date();
  const booking = await getSettings(db, "booking");
  if (!booking.onlineBookingEnabled) {
    throw new AppError("BOOKING_DISABLED", "O agendamento online está temporariamente desativado.", 403);
  }
  const svc = await getBookableService(db, params.serviceId);
  const rules = rulesOf(booking);
  const reason = dayWindowReason(params.date, rules, now);
  if (reason) return { slots: [], reason, timezone: booking.timezone };
  const ctx = await loadDayContext(db, params.date, booking.timezone, now);
  const slots = computeSlots({ date: params.date, durationMinutes: svc.durationMinutes, rules, ...ctx, now });
  return { slots, reason: null, timezone: booking.timezone };
}

/* ------------------------------------------------------------------ */
/* Reserva temporária (hold)                                           */
/* ------------------------------------------------------------------ */

export async function createHold(
  db: DbLike,
  params: { serviceId: string; startsAt: Date; ipHash: string; now?: Date },
) {
  const now = params.now ?? new Date();
  const booking = await getSettings(db, "booking");
  if (!booking.onlineBookingEnabled) {
    throw new AppError("BOOKING_DISABLED", "O agendamento online está temporariamente desativado.", 403);
  }

  return withScheduleLock(db, async (tx) => {
    await expireStaleHolds(tx, now);

    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(eq(appointments.status, "held"), eq(appointments.holdIpHash, params.ipHash)));
    if (n >= MAX_ACTIVE_HOLDS_PER_IP) {
      throw new AppError("TOO_MANY_HOLDS", "Você já possui reservas temporárias em andamento. Conclua ou aguarde alguns minutos.", 429);
    }

    const svc = await getBookableService(tx, params.serviceId);
    const date = toLocalDate(params.startsAt, booking.timezone);
    const ctx = await loadDayContext(tx, date, booking.timezone, now);
    const slot = findSlot(
      { date, durationMinutes: svc.durationMinutes, rules: rulesOf(booking), ...ctx, now },
      params.startsAt,
    );
    if (!slot) throw slotUnavailable();

    const token = generateToken();
    const holdExpiresAt = new Date(now.getTime() + booking.holdMinutes * 60_000);
    const [row] = await tx
      .insert(appointments)
      .values({
        protocol: generateProtocol("AG"),
        accessTokenHash: sha256(token),
        serviceId: svc.id,
        status: "held",
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        blockedUntil: slot.blockedUntil,
        holdExpiresAt,
        holdIpHash: params.ipHash,
        source: "online",
      })
      .returning({ id: appointments.id });

    return { appointmentId: row.id, holdToken: token, holdExpiresAt, startsAt: slot.startsAt, endsAt: slot.endsAt };
  });
}

/** Libera uma reserva temporária quando o cliente volta e escolhe outro horário. */
export async function releaseHold(db: DbLike, holdToken: string) {
  await db
    .update(appointments)
    .set({ status: "expired", holdExpiresAt: new Date() })
    .where(and(eq(appointments.accessTokenHash, sha256(holdToken)), eq(appointments.status, "held")));
}

/* ------------------------------------------------------------------ */
/* Confirmação dos dados pelo cliente                                  */
/* ------------------------------------------------------------------ */

export async function confirmHold(
  db: DbLike,
  params: { holdToken: string; contact: ContactInput; notes: string; now?: Date },
) {
  const now = params.now ?? new Date();
  const booking = await getSettings(db, "booking");

  return withScheduleLock(db, async (tx) => {
    const [appt] = await tx
      .select()
      .from(appointments)
      .where(eq(appointments.accessTokenHash, sha256(params.holdToken)))
      .for("update");

    if (!appt) throw new AppError("HOLD_NOT_FOUND", "Reserva não encontrada. Escolha o horário novamente.", 404);

    // Idempotência: um reenvio do mesmo formulário devolve o resultado já gravado.
    if (appt.status === "pending" || appt.status === "confirmed") {
      return { appointment: appt, created: false };
    }
    if (appt.status !== "held" && appt.status !== "expired") {
      throw new AppError("HOLD_NOT_FOUND", "Esta reserva não está mais disponível. Escolha o horário novamente.", 409);
    }

    // Revalida o horário com as regras atuais, ignorando a própria reserva.
    const svc = await getBookableService(tx, appt.serviceId);
    const holdValid = appt.status === "held" && appt.holdExpiresAt != null && appt.holdExpiresAt > now;
    const date = toLocalDate(appt.startsAt, booking.timezone);
    const ctx = await loadDayContext(tx, date, booking.timezone, now, [appt.id]);
    const slot = findSlot(
      {
        date,
        durationMinutes: svc.durationMinutes,
        rules: rulesOf(booking),
        ...ctx,
        // enquanto a reserva é válida, a antecedência mínima é avaliada no momento da reserva
        now: holdValid ? appt.createdAt : now,
      },
      appt.startsAt,
    );
    if (!slot) throw slotUnavailable();

    const client = await upsertClientFromContact(tx, params.contact, now);
    const status: AppointmentStatus = booking.autoConfirm ? "confirmed" : "pending";

    const [updated] = await tx
      .update(appointments)
      .set({
        status,
        clientId: client.id,
        clientNotes: params.notes || null,
        holdExpiresAt: null,
        holdIpHash: null,
        confirmedAt: status === "confirmed" ? now : null,
      })
      .where(eq(appointments.id, appt.id))
      .returning();

    await audit(tx, CLIENT, "appointment.requested", { type: "appointment", id: appt.id }, { status });
    return { appointment: updated, created: true };
  });
}

/* ------------------------------------------------------------------ */
/* Acesso do cliente pelo link secreto                                 */
/* ------------------------------------------------------------------ */

export type ClientAppointmentView = Awaited<ReturnType<typeof getAppointmentChainByToken>>;

/** Resolve o token do link de acompanhamento para a cadeia de agendamentos do cliente. */
export async function getAppointmentChainByToken(db: DbLike, token: string) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [root] = await db.select().from(appointments).where(eq(appointments.accessTokenHash, sha256(token)));
  if (!root || root.status === "held") return null;
  const chain = await db
    .select({ appt: appointments, service: services })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(or(eq(appointments.id, root.id), eq(appointments.rootId, root.id)))
    .orderBy(asc(appointments.createdAt));
  const client = root.clientId
    ? (await db.select().from(clients).where(eq(clients.id, root.clientId)))[0] ?? null
    : null;
  return { root, chain, client };
}

async function lockChainTarget(tx: DbLike, token: string, appointmentId: string) {
  const [root] = await tx.select().from(appointments).where(eq(appointments.accessTokenHash, sha256(token)));
  if (!root) throw new AppError("NOT_FOUND", "Agendamento não encontrado.", 404);
  const [target] = await tx
    .select()
    .from(appointments)
    .where(
      and(eq(appointments.id, appointmentId), or(eq(appointments.id, root.id), eq(appointments.rootId, root.id))),
    )
    .for("update");
  // O identificador sozinho não concede acesso: precisa pertencer à cadeia do token.
  if (!target) throw new AppError("NOT_FOUND", "Agendamento não encontrado.", 404);
  return { root, target };
}

export async function cancelByClient(
  db: DbLike,
  params: { token: string; appointmentId: string; reason: string; now?: Date },
) {
  const now = params.now ?? new Date();
  const booking = await getSettings(db, "booking");
  return withScheduleLock(db, async (tx) => {
    const { target } = await lockChainTarget(tx, params.token, params.appointmentId);
    const decision = clientChangeDecision("cancel", target, booking, now);
    if (!decision.allowed) throw new AppError("POLICY", decision.reason, 403);
    const [updated] = await tx
      .update(appointments)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: "client",
        cancelReason: params.reason || "Cancelado pelo cliente",
      })
      .where(eq(appointments.id, target.id))
      .returning();
    await audit(tx, CLIENT, "appointment.cancelled", { type: "appointment", id: target.id }, { by: "client" });
    return updated;
  });
}

export async function rescheduleByClient(
  db: DbLike,
  params: { token: string; appointmentId: string; startsAt: Date; now?: Date },
) {
  const now = params.now ?? new Date();
  const booking = await getSettings(db, "booking");
  return withScheduleLock(db, async (tx) => {
    await expireStaleHolds(tx, now);
    const { root, target } = await lockChainTarget(tx, params.token, params.appointmentId);
    const decision = clientChangeDecision("reschedule", target, booking, now);
    if (!decision.allowed) throw new AppError("POLICY", decision.reason, 403);

    const [pendingChild] = await tx
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.rescheduledFromId, target.id), eq(appointments.status, "pending")));
    if (pendingChild) {
      throw new AppError("ALREADY_REQUESTED", "Já existe um pedido de reagendamento aguardando aprovação.", 409);
    }

    const svc = await getBookableService(tx, target.serviceId);
    const date = toLocalDate(params.startsAt, booking.timezone);
    const ctx = await loadDayContext(tx, date, booking.timezone, now, [target.id]);
    const slot = findSlot(
      { date, durationMinutes: svc.durationMinutes, rules: rulesOf(booking), ...ctx, now },
      params.startsAt,
    );
    if (!slot) throw slotUnavailable();

    const needsApproval = booking.rescheduleRequiresApproval;
    if (!needsApproval) {
      await tx
        .update(appointments)
        .set({ status: "cancelled", cancelledAt: now, cancelledBy: "client", cancelReason: "Reagendado pelo cliente" })
        .where(eq(appointments.id, target.id));
    }
    const [created] = await tx
      .insert(appointments)
      .values({
        protocol: generateProtocol("AG"),
        rootId: root.id,
        rescheduledFromId: target.id,
        clientId: target.clientId,
        serviceId: target.serviceId,
        quoteId: target.quoteId,
        status: needsApproval ? "pending" : target.status,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        blockedUntil: slot.blockedUntil,
        source: target.source,
        clientNotes: target.clientNotes,
        confirmedAt: !needsApproval && target.status === "confirmed" ? now : null,
      })
      .returning();
    await audit(tx, CLIENT, "appointment.rescheduled", { type: "appointment", id: target.id }, {
      newAppointmentId: created.id,
      needsApproval,
    });
    return { created, previous: target, needsApproval };
  });
}

/* ------------------------------------------------------------------ */
/* Operações administrativas                                           */
/* ------------------------------------------------------------------ */

export async function adminSetStatus(
  db: DbLike,
  params: { id: string; to: AppointmentStatus; reason?: string; actor: Actor; now?: Date },
) {
  const now = params.now ?? new Date();
  return withScheduleLock(db, async (tx) => {
    const [appt] = await tx.select().from(appointments).where(eq(appointments.id, params.id)).for("update");
    if (!appt) throw new AppError("NOT_FOUND", "Agendamento não encontrado.", 404);
    if (appt.status === "held" || appt.status === "expired") {
      throw new AppError("INVALID", "Reservas temporárias não podem ser alteradas pelo painel.", 409);
    }
    if (!canTransitionAppointment(appt.status, params.to)) {
      throw new AppError("INVALID_TRANSITION", "Esta mudança de status não é permitida.", 409);
    }
    const patch: Partial<Appointment> = { status: params.to };
    if (params.to === "confirmed") patch.confirmedAt = now;
    if (params.to === "completed") patch.completedAt = now;
    if (params.to === "cancelled") {
      patch.cancelledAt = now;
      patch.cancelledBy = "admin";
      patch.cancelReason = params.reason?.trim() || "Cancelado pelo estúdio";
    }
    if (params.to === "confirmed" && appt.rescheduledFromId) {
      // aprovação de reagendamento: libera o horário anterior
      await tx
        .update(appointments)
        .set({ status: "cancelled", cancelledAt: now, cancelledBy: "admin", cancelReason: "Reagendado" })
        .where(and(eq(appointments.id, appt.rescheduledFromId), inArray(appointments.status, ["pending", "confirmed"])));
    }
    const [updated] = await tx.update(appointments).set(patch).where(eq(appointments.id, appt.id)).returning();
    await audit(tx, params.actor, "appointment.status", { type: "appointment", id: appt.id }, {
      from: appt.status,
      to: params.to,
      reason: patch.cancelReason,
    });
    return { before: appt, after: updated };
  });
}

type AdminScheduleInput = {
  startsAt: Date;
  durationMinutes: number;
  /** Permite marcar fora do expediente ou sobre bloqueios. Nunca permite sobreposição com outro agendamento. */
  overrideRules: boolean;
};

async function validateAdminSlot(
  tx: DbLike,
  booking: BookingSettings,
  input: AdminScheduleInput,
  now: Date,
  excludeIds: string[],
) {
  if (input.durationMinutes < 15 || input.durationMinutes > 720) {
    throw new AppError("INVALID", "Duração inválida (entre 15 e 720 minutos).");
  }
  const endsAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);
  const blockedUntil = new Date(endsAt.getTime() + booking.bufferMinutes * 60_000);
  if (!input.overrideRules) {
    const date = toLocalDate(input.startsAt, booking.timezone);
    const ctx = await loadDayContext(tx, date, booking.timezone, now, excludeIds);
    const rules = { ...rulesOf(booking), minNoticeHours: 0, maxAdvanceDays: 730 };
    const slots = computeSlots({ date, durationMinutes: input.durationMinutes, rules, ...ctx, now });
    const ok = slots.some((s) => s.startsAt.getTime() === input.startsAt.getTime());
    if (!ok) {
      throw new AppError(
        "SLOT_UNAVAILABLE",
        "Horário fora do expediente, bloqueado ou em conflito. Marque “ignorar expediente” para forçar (conflitos com outros agendamentos nunca são permitidos).",
        409,
      );
    }
  }
  return { endsAt, blockedUntil };
}

export async function adminCreateAppointment(
  db: DbLike,
  params: AdminScheduleInput & {
    serviceId: string;
    clientId?: string;
    contact?: Omit<ContactInput, "privacyConsent">;
    status: "pending" | "confirmed";
    internalNotes?: string;
    quoteId?: string;
    actor: Actor;
    now?: Date;
  },
) {
  const now = params.now ?? new Date();
  const booking = await getSettings(db, "booking");
  return withScheduleLock(db, async (tx) => {
    await expireStaleHolds(tx, now);
    const [svc] = await tx.select().from(services).where(eq(services.id, params.serviceId));
    if (!svc) throw new AppError("NOT_FOUND", "Serviço não encontrado.", 404);
    const { endsAt, blockedUntil } = await validateAdminSlot(tx, booking, params, now, []);

    let clientId = params.clientId;
    if (!clientId && params.contact) {
      clientId = (await upsertClientFromContact(tx, { ...params.contact, privacyConsent: true }, null)).id;
    }
    if (!clientId) throw new AppError("INVALID", "Informe o cliente.");

    const token = generateToken();
    const [row] = await tx
      .insert(appointments)
      .values({
        protocol: generateProtocol("AG"),
        accessTokenHash: sha256(token),
        clientId,
        serviceId: svc.id,
        quoteId: params.quoteId ?? null,
        status: params.status,
        startsAt: params.startsAt,
        endsAt,
        blockedUntil,
        source: params.quoteId ? "quote" : "admin",
        internalNotes: params.internalNotes || null,
        confirmedAt: params.status === "confirmed" ? now : null,
      })
      .returning();
    await audit(tx, params.actor, "appointment.created", { type: "appointment", id: row.id }, {
      status: row.status,
      overrideRules: params.overrideRules,
    });
    return { appointment: row, accessToken: token };
  });
}

export async function adminReschedule(
  db: DbLike,
  params: AdminScheduleInput & { id: string; actor: Actor; now?: Date },
) {
  const now = params.now ?? new Date();
  const booking = await getSettings(db, "booking");
  return withScheduleLock(db, async (tx) => {
    await expireStaleHolds(tx, now);
    const [appt] = await tx.select().from(appointments).where(eq(appointments.id, params.id)).for("update");
    if (!appt) throw new AppError("NOT_FOUND", "Agendamento não encontrado.", 404);
    if (appt.status !== "pending" && appt.status !== "confirmed") {
      throw new AppError("INVALID", "Somente agendamentos ativos podem ser remarcados.", 409);
    }
    const { endsAt, blockedUntil } = await validateAdminSlot(tx, booking, params, now, [appt.id]);
    const [updated] = await tx
      .update(appointments)
      .set({ startsAt: params.startsAt, endsAt, blockedUntil })
      .where(eq(appointments.id, appt.id))
      .returning();
    await audit(tx, params.actor, "appointment.rescheduled", { type: "appointment", id: appt.id }, {
      from: appt.startsAt.toISOString(),
      to: params.startsAt.toISOString(),
    });
    return { before: appt, after: updated };
  });
}

export async function adminUpdateNotes(
  db: DbLike,
  params: { id: string; internalNotes: string; depositReceived: boolean; actor: Actor },
) {
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, params.id));
  if (!appt) throw new AppError("NOT_FOUND", "Agendamento não encontrado.", 404);
  const depositReceivedAt = params.depositReceived ? (appt.depositReceivedAt ?? new Date()) : null;
  await db
    .update(appointments)
    .set({ internalNotes: params.internalNotes || null, depositReceivedAt })
    .where(eq(appointments.id, appt.id));
  if (Boolean(appt.depositReceivedAt) !== params.depositReceived) {
    await audit(db, params.actor, "appointment.deposit", { type: "appointment", id: appt.id }, {
      received: params.depositReceived,
    });
  }
}

/* ------------------------------ Bloqueios ----------------------------- */

export async function createBlock(
  db: DbLike,
  params: { startsAt: Date; endsAt: Date; reason: string; actor: Actor },
) {
  if (params.endsAt <= params.startsAt) throw new AppError("INVALID", "O fim do bloqueio deve ser após o início.");
  return withScheduleLock(db, async (tx) => {
    const [block] = await tx
      .insert(availabilityBlocks)
      .values({ startsAt: params.startsAt, endsAt: params.endsAt, reason: params.reason })
      .returning();
    // Agendamentos existentes não são cancelados automaticamente; o painel avisa sobre eles.
    const conflicts = await tx
      .select({ id: appointments.id, protocol: appointments.protocol, startsAt: appointments.startsAt })
      .from(appointments)
      .where(
        and(
          inArray(appointments.status, ["pending", "confirmed"]),
          lt(appointments.startsAt, params.endsAt),
          gt(appointments.endsAt, params.startsAt),
        ),
      );
    await audit(tx, params.actor, "block.created", { type: "block", id: block.id }, { conflicts: conflicts.length });
    return { block, conflicts };
  });
}

export async function deleteBlock(db: DbLike, id: string, actor: Actor) {
  const res = await db.delete(availabilityBlocks).where(eq(availabilityBlocks.id, id)).returning({ id: availabilityBlocks.id });
  if (res.length) await audit(db, actor, "block.deleted", { type: "block", id });
}

/* ----------------------------- Manutenção ---------------------------- */

export async function sweepExpiredHolds(db: DbLike, now = new Date()) {
  const res = await db
    .update(appointments)
    .set({ status: "expired" })
    .where(and(eq(appointments.status, "held"), lte(appointments.holdExpiresAt, now)))
    .returning({ id: appointments.id });
  return res.length;
}

