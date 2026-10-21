import { TZDate } from "@date-fns/tz";
import { AppError } from "./errors";

/**
 * Utilitários de data/hora. Todos os instantes são armazenados em UTC (timestamptz);
 * a conversão para o fuso do estúdio é sempre explícita.
 */

export type LocalDate = string; // YYYY-MM-DD no fuso do estúdio

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidLocalDate(value: string): value is LocalDate {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function parts(date: LocalDate) {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Data inválida: ${date}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** Converte data local + minutos desde a meia-noite (no fuso do estúdio) para um instante UTC. */
export function zonedToUtc(date: LocalDate, minuteOfDay: number, timeZone: string): Date {
  const { y, m, d } = parts(date);
  const h = Math.floor(minuteOfDay / 60);
  const min = minuteOfDay % 60;
  return new Date(new TZDate(y, m - 1, d, h, min, 0, 0, timeZone).getTime());
}

/** Início do dia (00:00) no fuso do estúdio, como instante UTC. */
export function startOfLocalDay(date: LocalDate, timeZone: string): Date {
  return zonedToUtc(date, 0, timeZone);
}

/** Data local (YYYY-MM-DD) de um instante no fuso indicado. */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const z = new TZDate(instant.getTime(), timeZone);
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`;
}

/** Minutos desde a meia-noite local de um instante. */
export function localMinuteOfDay(instant: Date, timeZone: string): number {
  const z = new TZDate(instant.getTime(), timeZone);
  return z.getHours() * 60 + z.getMinutes();
}

/** Dia da semana (0 = domingo) de uma data local. */
export function weekdayOf(date: LocalDate): number {
  const { y, m, d } = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysLocal(date: LocalDate, days: number): LocalDate {
  const { y, m, d } = parts(date);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function diffDaysLocal(a: LocalDate, b: LocalDate): number {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pa.y, pa.m - 1, pa.d) - Date.UTC(pb.y, pb.m - 1, pb.d)) / 86_400_000);
}

/** Segunda-feira da semana que contém a data. */
export function startOfWeekLocal(date: LocalDate): LocalDate {
  const wd = weekdayOf(date);
  return addDaysLocal(date, wd === 0 ? -6 : 1 - wd);
}

export function minutesToHHMM(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function hhmmToMinutes(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) return value === "24:00" ? 1440 : null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(timeZone: string, key: string, opts: Intl.DateTimeFormatOptions) {
  const k = `${timeZone}|${key}`;
  let f = fmtCache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat("pt-BR", { timeZone, ...opts });
    fmtCache.set(k, f);
  }
  return f;
}

export function formatTime(instant: Date, timeZone: string) {
  return fmt(timeZone, "t", { hour: "2-digit", minute: "2-digit" }).format(instant);
}

export function formatDateLong(instant: Date, timeZone: string) {
  return fmt(timeZone, "dl", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(instant);
}

export function formatDateShort(instant: Date, timeZone: string) {
  return fmt(timeZone, "ds", { day: "2-digit", month: "2-digit", year: "numeric" }).format(instant);
}

export function formatDateTime(instant: Date, timeZone: string) {
  return fmt(timeZone, "dt", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

/** Formata uma data local (YYYY-MM-DD) sem depender do fuso do servidor. */
export function formatLocalDate(date: LocalDate, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  const { y, m, d } = parts(date);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** Converte "YYYY-MM-DDTHH:mm" (horário local do estúdio, ex.: input datetime-local) em instante UTC. */
export function parseLocalDateTime(value: string, timeZone: string): Date {
  const [date, time] = value.split("T");
  const minutes = time ? hhmmToMinutes(time.slice(0, 5)) : null;
  if (!date || !isValidLocalDate(date) || minutes == null) {
    throw new AppError("INVALID", "Data/hora inválida.", 400, { startsAt: "Data/hora inválida." });
  }
  return zonedToUtc(date, minutes, timeZone);
}

/** Formata um instante como valor de input datetime-local no fuso indicado. */
export function toLocalDateTimeInput(instant: Date, timeZone: string): string {
  return `${toLocalDate(instant, timeZone)}T${minutesToHHMM(localMinuteOfDay(instant, timeZone))}`;
}
