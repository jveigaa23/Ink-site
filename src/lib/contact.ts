import type { StudioSettings } from "@/config/settings-schema";
import { minutesToHHMM } from "./time";

export const instagramUrl = (user: string) => (user ? `https://instagram.com/${encodeURIComponent(user)}` : "");

export function whatsappUrl(number: string, text?: string) {
  const digits = number.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function formatAddress(a: StudioSettings["address"]) {
  return [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(" — "), a.postalCode].filter(Boolean);
}

export const hasAddress = (a: StudioSettings["address"]) => a.showOnSite && Boolean(a.line1 && a.city);

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAY_NAMES = WEEKDAYS;

/** Agrupa o expediente por dia, começando na segunda-feira. */
export function hoursByDay(hours: { weekday: number; startMinute: number; endMinute: number }[]) {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    weekday: d,
    label: WEEKDAYS[d],
    intervals: hours
      .filter((h) => h.weekday === d)
      .sort((a, b) => a.startMinute - b.startMinute)
      .map((h) => `${minutesToHHMM(h.startMinute)}–${minutesToHHMM(h.endMinute)}`),
  }));
}
