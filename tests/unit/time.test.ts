import { describe, expect, it } from "vitest";
import {
  addDaysLocal,
  hhmmToMinutes,
  isValidLocalDate,
  localMinuteOfDay,
  startOfWeekLocal,
  toLocalDate,
  weekdayOf,
  zonedToUtc,
} from "@/lib/time";

describe("fuso horário", () => {
  it("converte entre horário local e UTC em São Paulo (UTC−3, sem horário de verão)", () => {
    const utc = zonedToUtc("2026-01-15", 14 * 60, "America/Sao_Paulo");
    expect(utc.toISOString()).toBe("2026-01-15T17:00:00.000Z");
    expect(toLocalDate(utc, "America/Sao_Paulo")).toBe("2026-01-15");
    expect(localMinuteOfDay(utc, "America/Sao_Paulo")).toBe(14 * 60);
  });

  it("trata a virada de dia entre fusos", () => {
    const late = zonedToUtc("2026-01-15", 23 * 60, "America/Sao_Paulo");
    expect(late.toISOString()).toBe("2026-01-16T02:00:00.000Z");
    expect(toLocalDate(late, "America/Sao_Paulo")).toBe("2026-01-15");
  });

  it("respeita horário de verão em fusos que o adotam", () => {
    // Lisboa: inverno UTC+0, verão UTC+1
    expect(zonedToUtc("2026-01-10", 600, "Europe/Lisbon").toISOString()).toBe("2026-01-10T10:00:00.000Z");
    expect(zonedToUtc("2026-07-10", 600, "Europe/Lisbon").toISOString()).toBe("2026-07-10T09:00:00.000Z");
  });

  it("valida e manipula datas locais", () => {
    expect(isValidLocalDate("2026-02-29")).toBe(false);
    expect(isValidLocalDate("2028-02-29")).toBe(true);
    expect(addDaysLocal("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOf("2026-11-04")).toBe(3);
    expect(startOfWeekLocal("2026-11-08")).toBe("2026-11-02");
    expect(hhmmToMinutes("09:30")).toBe(570);
    expect(hhmmToMinutes("25:00")).toBeNull();
  });
});
