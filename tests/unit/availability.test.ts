import { describe, expect, it } from "vitest";
import { computeSlots, dayWindowReason, openDates, type AvailabilityRules } from "@/domain/availability";

const rules: AvailabilityRules = {
  timezone: "America/Sao_Paulo",
  slotStepMinutes: 60,
  bufferMinutes: 30,
  minNoticeHours: 0,
  maxAdvanceDays: 30,
};
const hours = [{ weekday: 3, startMinute: 600, endMinute: 1080 }]; // quarta, 10h–18h
const date = "2026-11-04"; // quarta-feira
const now = new Date("2026-11-01T12:00:00Z");
const at = (hhmm: string) => new Date(`${date}T${hhmm}:00-03:00`);

describe("computeSlots", () => {
  it("gera horários dentro do expediente respeitando a duração", () => {
    const slots = computeSlots({ date, durationMinutes: 120, rules, hours, busy: [], now });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(
      ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"].map((h) => at(h).toISOString()),
    );
    expect(slots.at(-1)!.endsAt).toEqual(at("18:00"));
  });

  it("converte o horário local do estúdio para UTC explicitamente", () => {
    const [first] = computeSlots({ date, durationMinutes: 60, rules, hours, busy: [], now });
    expect(first.startsAt.toISOString()).toBe("2026-11-04T13:00:00.000Z");
  });

  it("respeita o intervalo de preparo entre sessões", () => {
    // sessão existente 12:00–14:00 + 30 min de preparo → ocupado até 14:30
    const busy = [{ start: at("12:00"), end: at("14:30") }];
    const slots = computeSlots({ date, durationMinutes: 120, rules, hours, busy, now });
    const starts = slots.map((s) => s.startsAt.getTime());
    // 10:00 termina 12:00 + 30 de preparo = 12:30 > 12:00 → conflito
    expect(starts).not.toContain(at("10:00").getTime());
    expect(starts).not.toContain(at("14:00").getTime());
    expect(starts).toContain(at("15:00").getTime());
    expect(slots.every((s) => s.blockedUntil.getTime() - s.endsAt.getTime() === 30 * 60_000)).toBe(true);
  });

  it("exclui horários bloqueados", () => {
    const busy = [{ start: at("10:00"), end: at("18:00") }];
    expect(computeSlots({ date, durationMinutes: 60, rules, hours, busy, now })).toEqual([]);
  });

  it("aplica antecedência mínima", () => {
    const localNow = new Date(`${date}T11:30:00-03:00`);
    const slots = computeSlots({ date, durationMinutes: 60, rules: { ...rules, minNoticeHours: 2 }, hours, busy: [], now: localNow });
    expect(slots[0].startsAt).toEqual(at("14:00"));
  });

  it("não oferece horários em dias sem expediente, passados ou além do horizonte", () => {
    expect(computeSlots({ date: "2026-11-05", durationMinutes: 60, rules, hours, busy: [], now })).toEqual([]);
    expect(dayWindowReason("2026-10-30", rules, now)).toBe("past");
    expect(dayWindowReason("2026-12-15", rules, now)).toBe("beyond_horizon");
    expect(dayWindowReason(date, rules, now)).toBeNull();
  });

  it("suporta vários intervalos no mesmo dia (pausa)", () => {
    const split = [
      { weekday: 3, startMinute: 600, endMinute: 720 },
      { weekday: 3, startMinute: 780, endMinute: 900 },
    ];
    const slots = computeSlots({ date, durationMinutes: 60, rules, hours: split, busy: [], now });
    expect(slots.map((s) => s.startsAt)).toEqual([at("10:00"), at("11:00"), at("13:00"), at("14:00")]);
  });

  it("lista as datas abertas dentro do horizonte", () => {
    const dates = openDates({ ...rules, maxAdvanceDays: 14 }, hours, now);
    expect(dates).toEqual(["2026-11-04", "2026-11-11"]);
  });
});
