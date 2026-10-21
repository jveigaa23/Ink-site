import {
  addDaysLocal,
  diffDaysLocal,
  toLocalDate,
  weekdayOf,
  zonedToUtc,
  type LocalDate,
} from "@/lib/time";

/**
 * Cálculo de disponibilidade — função pura, sem acesso a banco.
 * É a ÚNICA implementação das regras de horários: usada para exibir horários ao cliente
 * e para revalidar, dentro da transação, o horário escolhido antes de gravar.
 */

export type Interval = { start: Date; end: Date };

export type HoursInterval = { weekday: number; startMinute: number; endMinute: number };

export type AvailabilityRules = {
  timezone: string;
  slotStepMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
};

export type Slot = { startsAt: Date; endsAt: Date; blockedUntil: Date };

export type AvailabilityInput = {
  date: LocalDate;
  durationMinutes: number;
  rules: AvailabilityRules;
  hours: HoursInterval[];
  /** Intervalos já ocupados: agendamentos ativos [início, fim + preparo) e bloqueios. */
  busy: Interval[];
  now: Date;
};

export type DayUnavailableReason = "past" | "beyond_horizon" | "closed" | null;

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** Verifica se a data está dentro da janela de agendamento (antecedência e horizonte). */
export function dayWindowReason(date: LocalDate, rules: AvailabilityRules, now: Date): DayUnavailableReason {
  const today = toLocalDate(now, rules.timezone);
  const diff = diffDaysLocal(date, today);
  if (diff < 0) return "past";
  if (diff > rules.maxAdvanceDays) return "beyond_horizon";
  return null;
}

export function computeSlots(input: AvailabilityInput): Slot[] {
  const { date, durationMinutes, rules, hours, busy, now } = input;
  if (dayWindowReason(date, rules, now)) return [];
  const weekday = weekdayOf(date);
  const dayHours = hours
    .filter((h) => h.weekday === weekday)
    .sort((a, b) => a.startMinute - b.startMinute);

  const earliest = new Date(now.getTime() + rules.minNoticeHours * 3_600_000);
  const slots: Slot[] = [];
  const seen = new Set<number>();

  for (const h of dayHours) {
    for (let m = h.startMinute; m + durationMinutes <= h.endMinute; m += rules.slotStepMinutes) {
      const startsAt = zonedToUtc(date, m, rules.timezone);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
      const blockedUntil = new Date(endsAt.getTime() + rules.bufferMinutes * 60_000);
      if (startsAt < earliest) continue;
      const candidate = { start: startsAt, end: blockedUntil };
      if (busy.some((b) => overlaps(candidate, b))) continue;
      if (seen.has(startsAt.getTime())) continue;
      seen.add(startsAt.getTime());
      slots.push({ startsAt, endsAt, blockedUntil });
    }
  }
  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Busca o slot exato solicitado entre os disponíveis. */
export function findSlot(input: AvailabilityInput, startsAt: Date): Slot | undefined {
  return computeSlots(input).find((s) => s.startsAt.getTime() === startsAt.getTime());
}

/** Datas (no fuso do estúdio) entre hoje e o horizonte que possuem expediente configurado. */
export function openDates(rules: AvailabilityRules, hours: HoursInterval[], now: Date): LocalDate[] {
  const weekdays = new Set(hours.map((h) => h.weekday));
  const today = toLocalDate(now, rules.timezone);
  const out: LocalDate[] = [];
  for (let i = 0; i <= rules.maxAdvanceDays; i++) {
    const d = addDaysLocal(today, i);
    if (weekdays.has(weekdayOf(d))) out.push(d);
  }
  return out;
}
