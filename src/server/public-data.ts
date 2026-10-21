import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import { getSettings } from "@/server/settings";
import { getBusinessHours, listServices } from "@/server/catalog";
import { listCategories, listPublishedItems } from "@/server/portfolio/service";
import { TAGS } from "@/server/cache-tags";

/**
 * Dados públicos em cache (somente conteúdo publicado — nada pessoal ou de agenda).
 * Disponibilidade de horários NUNCA passa por aqui: é sempre calculada por requisição.
 */

export async function getPublicStudio() {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("hours");
  return getSettings(getDb(), "studio");
}

export async function getPublicBooking() {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("hours");
  const b = await getSettings(getDb(), "booking");
  return {
    onlineBookingEnabled: b.onlineBookingEnabled,
    timezone: b.timezone,
    maxAdvanceDays: b.maxAdvanceDays,
    minNoticeHours: b.minNoticeHours,
    holdMinutes: b.holdMinutes,
    autoConfirm: b.autoConfirm,
    allowClientCancel: b.allowClientCancel,
    allowClientReschedule: b.allowClientReschedule,
    rescheduleRequiresApproval: b.rescheduleRequiresApproval,
    cancellationNoticeHours: b.cancellationNoticeHours,
    depositRequired: b.depositRequired,
  };
}

export async function getPublicServices() {
  "use cache";
  cacheTag(TAGS.services);
  cacheLife("hours");
  const rows = await listServices(getDb(), { onlyActive: true });
  return rows.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    priceType: s.priceType,
    priceCents: s.priceCents,
    bookableOnline: s.bookableOnline,
  }));
}

export async function getPublicHours() {
  "use cache";
  cacheTag(TAGS.hours);
  cacheLife("hours");
  const rows = await getBusinessHours(getDb());
  return rows.map((h) => ({ weekday: h.weekday, startMinute: h.startMinute, endMinute: h.endMinute }));
}

export type PublicWork = Awaited<ReturnType<typeof getPublicPortfolio>>["items"][number];

export async function getPublicPortfolio() {
  "use cache";
  cacheTag(TAGS.portfolio);
  cacheLife("hours");
  const db = getDb();
  const [rows, categories] = await Promise.all([listPublishedItems(db), listCategories(db)]);
  const items = rows.map(({ item, category }) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    description: item.description,
    altText: item.altText,
    imageUrl: item.imageUrl,
    width: item.width,
    height: item.height,
    blurDataUrl: item.blurDataUrl,
    featured: item.featured,
    isDemo: item.isDemo,
    category: category ? { slug: category.slug, name: category.name } : null,
  }));
  const used = new Set(items.map((i) => i.category?.slug).filter(Boolean));
  return {
    items,
    categories: categories.filter((c) => used.has(c.slug)).map((c) => ({ slug: c.slug, name: c.name, description: c.description })),
  };
}
