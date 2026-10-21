import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { appointments, availabilityBlocks, notifications } from "@/db/schema";
import {
  adminCreateAppointment,
  adminReschedule,
  adminSetStatus,
  cancelByClient,
  confirmHold,
  createBlock,
  createHold,
  getAppointmentChainByToken,
  getAvailability,
  rescheduleByClient,
} from "@/server/booking/service";
import { notifyAppointment } from "@/server/notifications/events";
import { db, hasDb, resetDb, seedStudio } from "../support/db";

const NOW = new Date("2026-11-02T12:00:00Z"); // segunda-feira, 09:00 em São Paulo
const DATE = "2026-11-04"; // quarta-feira
const at = (hhmm: string, date = DATE) => new Date(`${date}T${hhmm}:00-03:00`);
const contact = { name: "Ana Souza", email: "ana@example.com", phone: "11988887777", privacyConsent: true as const };
const admin = { type: "admin" as const, id: "00000000-0000-0000-0000-000000000001" };

describe.skipIf(!hasDb)("agendamento (integração)", () => {
  let serviceId: string;
  beforeEach(async () => {
    await resetDb();
    serviceId = (await seedStudio()).id;
  });

  async function book(startsAt: Date, ip = "ip-a") {
    const hold = await createHold(db, { serviceId, startsAt, ipHash: ip, now: NOW });
    const res = await confirmHold(db, { holdToken: hold.holdToken, contact, notes: "", now: NOW });
    return { hold, ...res };
  }

  it("lista horários reais e remove o horário após uma reserva", async () => {
    const before = await getAvailability(db, { serviceId, date: DATE, now: NOW });
    expect(before.slots.map((s) => s.startsAt)).toContainEqual(at("12:00"));
    await createHold(db, { serviceId, startsAt: at("12:00"), ipHash: "x", now: NOW });
    const after = await getAvailability(db, { serviceId, date: DATE, now: NOW });
    const starts = after.slots.map((s) => s.startsAt.getTime());
    // 2h de sessão + 30 min de preparo: 10h, 11h, 12h, 13h e 14h ficam indisponíveis
    for (const h of ["10:00", "11:00", "12:00", "13:00", "14:00"]) expect(starts).not.toContain(at(h).getTime());
    expect(starts).toContain(at("15:00").getTime());
  });

  it("confirma a solicitação como pendente (não como agendamento confirmado)", async () => {
    const { appointment, hold } = await book(at("10:00"));
    expect(appointment.status).toBe("pending");
    const view = await getAppointmentChainByToken(db, hold.holdToken);
    expect(view?.chain[0].appt.protocol).toMatch(/^AG-/);
  });

  it("é idempotente ao reenviar o mesmo formulário", async () => {
    const hold = await createHold(db, { serviceId, startsAt: at("10:00"), ipHash: "a", now: NOW });
    const first = await confirmHold(db, { holdToken: hold.holdToken, contact, notes: "", now: NOW });
    const second = await confirmHold(db, { holdToken: hold.holdToken, contact, notes: "", now: NOW });
    expect(second.created).toBe(false);
    expect(second.appointment.id).toBe(first.appointment.id);
  });

  it("impede conflitos com requisições simultâneas no mesmo horário", async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) => createHold(db, { serviceId, startsAt: at("14:00"), ipHash: `ip-${i}`, now: NOW })),
    );
    const ok = attempts.filter((a) => a.status === "fulfilled");
    const failed = attempts.filter((a) => a.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed.every((f) => f.reason?.code === "SLOT_UNAVAILABLE")).toBe(true);
  });

  it("a restrição do banco barra sobreposição mesmo sem passar pela aplicação", async () => {
    await book(at("10:00"));
    const [svcRow] = await db.select().from(appointments);
    await expect(
      db.insert(appointments).values({
        protocol: "AG-TEST-0001",
        serviceId: svcRow.serviceId,
        status: "confirmed",
        startsAt: at("11:00"),
        endsAt: at("12:00"),
        blockedUntil: at("12:30"),
      }),
    ).rejects.toMatchObject({ cause: { code: "23P01" } });
  });

  it("reservas temporárias expiram no servidor e liberam o horário", async () => {
    const hold = await createHold(db, { serviceId, startsAt: at("10:00"), ipHash: "a", now: NOW });
    const later = new Date(NOW.getTime() + 11 * 60_000); // padrão: 10 minutos
    const avail = await getAvailability(db, { serviceId, date: DATE, now: later });
    expect(avail.slots.map((s) => s.startsAt)).toContainEqual(at("10:00"));
    // outro cliente reserva o horário liberado
    await createHold(db, { serviceId, startsAt: at("10:00"), ipHash: "b", now: later });
    // a confirmação tardia do primeiro cliente é recusada
    await expect(confirmHold(db, { holdToken: hold.holdToken, contact, notes: "", now: later })).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE",
    });
  });

  it("aceita confirmação tardia se o horário seguir livre", async () => {
    const hold = await createHold(db, { serviceId, startsAt: at("10:00"), ipHash: "a", now: NOW });
    const later = new Date(NOW.getTime() + 15 * 60_000);
    const res = await confirmHold(db, { holdToken: hold.holdToken, contact, notes: "", now: later });
    expect(res.appointment.status).toBe("pending");
  });

  it("limita reservas temporárias simultâneas por IP", async () => {
    for (const h of ["10:00", "13:00", "16:00"]) await createHold(db, { serviceId, startsAt: at(h), ipHash: "same", now: NOW });
    await expect(
      createHold(db, { serviceId, startsAt: at("10:00", "2026-11-05"), ipHash: "same", now: NOW }),
    ).rejects.toMatchObject({ code: "TOO_MANY_HOLDS" });
  });

  it("recusa horários fora do expediente, bloqueados ou fora da grade", async () => {
    await expect(createHold(db, { serviceId, startsAt: at("17:00"), ipHash: "a", now: NOW })).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    await expect(createHold(db, { serviceId, startsAt: at("10:15"), ipHash: "a", now: NOW })).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    await expect(createHold(db, { serviceId, startsAt: at("10:00", "2026-11-07"), ipHash: "a", now: NOW })).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    await db.insert(availabilityBlocks).values({ startsAt: at("00:00"), endsAt: at("23:59"), reason: "Folga" });
    expect((await getAvailability(db, { serviceId, date: DATE, now: NOW })).slots).toEqual([]);
  });

  it("bloqueio criado durante a reserva invalida a confirmação", async () => {
    const hold = await createHold(db, { serviceId, startsAt: at("10:00"), ipHash: "a", now: NOW });
    const { conflicts } = await createBlock(db, { startsAt: at("09:00"), endsAt: at("13:00"), reason: "Compromisso", actor: admin });
    expect(conflicts).toHaveLength(0); // reservas temporárias não contam como agendamento
    await expect(confirmHold(db, { holdToken: hold.holdToken, contact, notes: "", now: NOW })).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("cliente cancela dentro do prazo e o horário é liberado", async () => {
    const { hold, appointment } = await book(at("10:00"));
    await cancelByClient(db, { token: hold.holdToken, appointmentId: appointment.id, reason: "Imprevisto", now: NOW });
    const avail = await getAvailability(db, { serviceId, date: DATE, now: NOW });
    expect(avail.slots.map((s) => s.startsAt)).toContainEqual(at("10:00"));
  });

  it("cliente não cancela fora do prazo nem altera agendamento de outra pessoa", async () => {
    const mine = await book(at("10:00"));
    const other = await book(at("15:00"), "ip-b");
    // prazo padrão: 48 h; a sessão é em 2 dias e 1 h → faltando 47 h é recusado
    const tooLate = new Date(at("10:00").getTime() - 47 * 3_600_000);
    await expect(
      cancelByClient(db, { token: mine.hold.holdToken, appointmentId: mine.appointment.id, reason: "", now: tooLate }),
    ).rejects.toMatchObject({ code: "POLICY" });
    // o identificador de outro agendamento não é aceito com o token errado
    await expect(
      cancelByClient(db, { token: mine.hold.holdToken, appointmentId: other.appointment.id, reason: "", now: NOW }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      cancelByClient(db, { token: "x".repeat(43), appointmentId: other.appointment.id, reason: "", now: NOW }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reagendamento com aprovação mantém o horário anterior até o estúdio aprovar", async () => {
    const { hold, appointment } = await book(at("10:00"));
    const r = await rescheduleByClient(db, { token: hold.holdToken, appointmentId: appointment.id, startsAt: at("15:00"), now: NOW });
    expect(r.needsApproval).toBe(true);
    expect(r.created.status).toBe("pending");
    const [old] = await db.select().from(appointments).where(eq(appointments.id, appointment.id));
    expect(old.status).toBe("pending");
    await adminSetStatus(db, { id: r.created.id, to: "confirmed", actor: admin, now: NOW });
    const [oldAfter] = await db.select().from(appointments).where(eq(appointments.id, appointment.id));
    expect(oldAfter.status).toBe("cancelled");
    const view = await getAppointmentChainByToken(db, hold.holdToken);
    expect(view?.chain).toHaveLength(2);
  });

  it("reagendamento sem aprovação move o agendamento imediatamente", async () => {
    await resetDb();
    serviceId = (await seedStudio({ rescheduleRequiresApproval: false })).id;
    const { hold, appointment } = await book(at("10:00"));
    const r = await rescheduleByClient(db, { token: hold.holdToken, appointmentId: appointment.id, startsAt: at("12:00"), now: NOW });
    expect(r.needsApproval).toBe(false);
    const [old] = await db.select().from(appointments).where(eq(appointments.id, appointment.id));
    expect(old.status).toBe("cancelled");
    expect(r.created.status).toBe("pending");
  });

  it("administrador cria, remarca e conclui; transições inválidas são recusadas", async () => {
    const { appointment, accessToken } = await adminCreateAppointment(db, {
      serviceId,
      contact: { name: "Bruno", email: "", phone: "11977776666" },
      startsAt: at("10:00"),
      durationMinutes: 180,
      status: "confirmed",
      overrideRules: false,
      actor: admin,
      now: NOW,
    });
    expect(accessToken.length).toBeGreaterThan(30);
    // conflito com agendamento existente é recusado mesmo ignorando o expediente
    await expect(
      adminCreateAppointment(db, {
        serviceId,
        contact: { name: "Carla", email: "c@example.com", phone: "" },
        startsAt: at("12:00"),
        durationMinutes: 60,
        status: "confirmed",
        overrideRules: true,
        actor: admin,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    // fora do expediente só com override
    await expect(
      adminReschedule(db, { id: appointment.id, startsAt: at("19:00"), durationMinutes: 120, overrideRules: false, actor: admin, now: NOW }),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    const moved = await adminReschedule(db, { id: appointment.id, startsAt: at("19:00"), durationMinutes: 120, overrideRules: true, actor: admin, now: NOW });
    expect(moved.after.startsAt).toEqual(at("19:00"));
    await expect(adminSetStatus(db, { id: appointment.id, to: "pending", actor: admin, now: NOW })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    const done = await adminSetStatus(db, { id: appointment.id, to: "completed", actor: admin, now: NOW });
    expect(done.after.completedAt).not.toBeNull();
  });

  it("sem provedor de e-mail, a notificação fica pendente para envio manual (sem simular envio)", async () => {
    delete process.env.RESEND_API_KEY;
    const { appointment } = await book(at("10:00"));
    await notifyAppointment(db, appointment.id, "received");
    const rows = await db.select().from(notifications);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ channel: "whatsapp_manual", status: "manual_pending" });
    await notifyAppointment(db, appointment.id, "received");
    expect(await db.select().from(notifications)).toHaveLength(1); // idempotente
  });
});
