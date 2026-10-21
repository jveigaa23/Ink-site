import { describe, expect, it } from "vitest";
import { canTransitionAppointment, canTransitionQuote, clientChangeDecision } from "@/domain/status";

const policy = { allowClientCancel: true, allowClientReschedule: true, cancellationNoticeHours: 48 };
const start = new Date("2026-11-10T15:00:00Z");

describe("transições de status", () => {
  it("orçamentos seguem o fluxo definido", () => {
    expect(canTransitionQuote("received", "in_review")).toBe(true);
    expect(canTransitionQuote("in_review", "approved")).toBe(true);
    expect(canTransitionQuote("approved", "received")).toBe(false);
    expect(canTransitionQuote("archived", "in_review")).toBe(true);
    expect(canTransitionQuote("declined", "approved")).toBe(false);
  });

  it("agendamentos não voltam de estados finais", () => {
    expect(canTransitionAppointment("pending", "confirmed")).toBe(true);
    expect(canTransitionAppointment("confirmed", "completed")).toBe(true);
    expect(canTransitionAppointment("cancelled", "confirmed")).toBe(false);
    expect(canTransitionAppointment("completed", "cancelled")).toBe(false);
    expect(canTransitionAppointment("pending", "completed")).toBe(false);
  });
});

describe("regras de cancelamento pelo cliente", () => {
  it("permite dentro do prazo", () => {
    const now = new Date(start.getTime() - 72 * 3_600_000);
    expect(clientChangeDecision("cancel", { status: "confirmed", startsAt: start }, policy, now).allowed).toBe(true);
  });

  it("bloqueia após o prazo mínimo", () => {
    const now = new Date(start.getTime() - 24 * 3_600_000);
    const d = clientChangeDecision("cancel", { status: "confirmed", startsAt: start }, policy, now);
    expect(d.allowed).toBe(false);
  });

  it("respeita configurações desativadas e status finais", () => {
    const now = new Date(start.getTime() - 72 * 3_600_000);
    expect(clientChangeDecision("reschedule", { status: "confirmed", startsAt: start }, { ...policy, allowClientReschedule: false }, now).allowed).toBe(false);
    expect(clientChangeDecision("cancel", { status: "cancelled", startsAt: start }, policy, now).allowed).toBe(false);
  });
});
