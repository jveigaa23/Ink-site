"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import type { MediaRef, StudioSettings } from "@/config/settings-schema";
import { AppError } from "@/lib/errors";
import { hhmmToMinutes } from "@/lib/time";
import { isNextControlFlow, toErrorState, type ActionState } from "@/server/action-result";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/auth/session";
import { TAGS } from "@/server/cache-tags";
import { replaceBusinessHours, type HoursInput } from "@/server/catalog";
import { getSettings, saveSettings } from "@/server/settings";
import { deleteObject, putObject } from "@/server/storage";
import { processImage, safeObjectKey } from "@/server/storage/images";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const b = (fd: FormData, k: string) => fd.get(k) === "on";
const n = (fd: FormData, k: string) => Number(fd.get(k));

async function saveStudio(patch: (cur: StudioSettings) => StudioSettings, adminId: string, section: string) {
  const db = getDb();
  const current = await getSettings(db, "studio");
  await saveSettings(db, "studio", patch(current));
  await audit(db, { type: "admin", id: adminId }, "settings.updated", { type: "settings", id: "studio" }, { section });
  updateTag(TAGS.settings);
}

function zodToState(e: unknown) {
  if (e instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const i of e.issues) {
      const key = i.path.at(-1)?.toString() ?? "_form";
      fieldErrors[key] ??= i.message;
    }
    return { status: "error" as const, message: "Revise os campos destacados.", fieldErrors };
  }
  return toErrorState(e);
}

export async function saveIdentityAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    await saveStudio(
      (c) => ({
        ...c,
        name: s(fd, "name"),
        namePending: b(fd, "namePending"),
        tagline: s(fd, "tagline"),
        heroTitle: s(fd, "heroTitle"),
        heroSubtitle: s(fd, "heroSubtitle"),
        seoDescription: s(fd, "seoDescription"),
        accentColor: s(fd, "accentColor"),
      }),
      admin.id,
      "identity",
    );
    return { status: "success", message: "Identidade salva." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return zodToState(e);
  }
}

export async function saveContentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const specialties = s(fd, "specialties")
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);
    await saveStudio(
      (c) => ({
        ...c,
        artistName: s(fd, "artistName"),
        artistBio: s(fd, "artistBio"),
        studioStory: s(fd, "studioStory"),
        specialties,
        attendanceInfo: s(fd, "attendanceInfo"),
        aftercare: s(fd, "aftercare"),
        depositPolicy: s(fd, "depositPolicy"),
        cancellationPolicyText: s(fd, "cancellationPolicyText"),
      }),
      admin.id,
      "content",
    );
    return { status: "success", message: "Conteúdo salvo." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return zodToState(e);
  }
}

export async function saveContactAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const otherLinks = [0, 1, 2]
      .map((i) => ({ label: s(fd, `linkLabel${i}`).trim(), url: s(fd, `linkUrl${i}`).trim() }))
      .filter((l) => l.label && l.url);
    await saveStudio(
      (c) => ({
        ...c,
        contact: {
          whatsapp: s(fd, "whatsapp").replace(/[^\d+]/g, ""),
          phoneDisplay: s(fd, "phoneDisplay"),
          email: s(fd, "email"),
          instagram: s(fd, "instagram").replace(/^@/, "").trim(),
          otherLinks,
        },
        address: {
          line1: s(fd, "line1"),
          line2: s(fd, "line2"),
          city: s(fd, "city"),
          state: s(fd, "state"),
          postalCode: s(fd, "postalCode"),
          mapsUrl: s(fd, "mapsUrl"),
          showOnSite: b(fd, "showOnSite"),
        },
        hoursNote: s(fd, "hoursNote"),
        privacyContactEmail: s(fd, "privacyContactEmail"),
      }),
      admin.id,
      "contact",
    );
    return { status: "success", message: "Contatos salvos." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return zodToState(e);
  }
}

const IMAGE_SLOTS = ["logo", "heroImage", "artistPhoto", "studioPhotos"] as const;

export async function uploadSiteImageAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const slot = z.enum(IMAGE_SLOTS).parse(fd.get("slot"));
    const file = fd.get("image");
    if (!(file instanceof File) || file.size === 0) throw new AppError("INVALID", "Selecione uma imagem.");
    const alt = z.string().trim().max(200).parse(fd.get("alt") ?? "");
    const img = await processImage(file, { maxDimension: slot === "logo" ? 800 : 2400 });
    const stored = await putObject(safeObjectKey("site"), img.buffer, img.contentType, "public");
    const ref: MediaRef = { key: stored.key, url: stored.url, width: img.width, height: img.height, alt, blurDataUrl: img.blurDataUrl };
    let replaced: MediaRef | null = null;
    try {
      await saveStudio(
        (c) => {
          if (slot === "studioPhotos") {
            if (c.studioPhotos.length >= 12) throw new AppError("LIMIT", "Limite de 12 fotos do ambiente.");
            return { ...c, studioPhotos: [...c.studioPhotos, ref] };
          }
          replaced = c[slot];
          return { ...c, [slot]: ref };
        },
        admin.id,
        `image:${slot}`,
      );
    } catch (e) {
      await deleteObject(stored.key, "public").catch(() => {});
      throw e;
    }
    const old = replaced as MediaRef | null;
    if (old) await deleteObject(old.key, "public").catch(() => {});
    return { status: "success", message: "Imagem salva." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return zodToState(e);
  }
}

export async function removeSiteImageAction(fd: FormData) {
  const admin = await requireAdmin();
  const slot = z.enum(IMAGE_SLOTS).parse(fd.get("slot"));
  const key = z.string().max(300).parse(fd.get("key"));
  await saveStudio(
    (c) =>
      slot === "studioPhotos"
        ? { ...c, studioPhotos: c.studioPhotos.filter((p) => p.key !== key) }
        : c[slot]?.key === key
          ? { ...c, [slot]: null }
          : c,
    admin.id,
    `image:${slot}:remove`,
  );
  await deleteObject(key, "public").catch(() => {});
}

export async function saveBookingRulesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    await saveSettings(db, "booking", {
      onlineBookingEnabled: b(fd, "onlineBookingEnabled"),
      timezone: s(fd, "timezone"),
      slotStepMinutes: n(fd, "slotStepMinutes"),
      bufferMinutes: n(fd, "bufferMinutes"),
      minNoticeHours: n(fd, "minNoticeHours"),
      maxAdvanceDays: n(fd, "maxAdvanceDays"),
      holdMinutes: n(fd, "holdMinutes"),
      autoConfirm: b(fd, "autoConfirm"),
      allowClientCancel: b(fd, "allowClientCancel"),
      allowClientReschedule: b(fd, "allowClientReschedule"),
      rescheduleRequiresApproval: b(fd, "rescheduleRequiresApproval"),
      cancellationNoticeHours: n(fd, "cancellationNoticeHours"),
      depositRequired: b(fd, "depositRequired"),
    });
    await audit(db, { type: "admin", id: admin.id }, "settings.updated", { type: "settings", id: "booking" });
    updateTag(TAGS.settings);
    return { status: "success", message: "Regras de agendamento salvas." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return zodToState(e);
  }
}

export async function saveHoursAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const hours: HoursInput = [];
    for (let d = 0; d < 7; d++) {
      if (!b(fd, `open-${d}`)) continue;
      for (const i of [0, 1]) {
        const start = s(fd, `start-${d}-${i}`);
        const end = s(fd, `end-${d}-${i}`);
        if (!start && !end) continue;
        const sm = hhmmToMinutes(start);
        const em = end === "00:00" ? 1440 : hhmmToMinutes(end);
        if (sm == null || em == null || sm >= em) throw new AppError("INVALID", "Há um intervalo de horário inválido (início deve ser antes do fim).");
        hours.push({ weekday: d, startMinute: sm, endMinute: em });
      }
    }
    await replaceBusinessHours(getDb(), hours, { type: "admin", id: admin.id });
    updateTag(TAGS.hours);
    return { status: "success", message: "Horário de atendimento salvo." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return zodToState(e);
  }
}

export async function saveNotificationPrefsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    await saveSettings(db, "notifications", {
      emailEnabled: b(fd, "emailEnabled"),
      adminEmail: s(fd, "adminEmail").trim(),
      reminderHoursBefore: n(fd, "reminderHoursBefore"),
      notifyAdminOnNewRequests: b(fd, "notifyAdminOnNewRequests"),
    });
    await saveSettings(db, "privacy", {
      quoteRetentionMonths: n(fd, "quoteRetentionMonths"),
      clientRetentionMonths: n(fd, "clientRetentionMonths"),
    });
    await audit(db, { type: "admin", id: admin.id }, "settings.updated", { type: "settings", id: "notifications" });
    return { status: "success", message: "Preferências salvas." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return zodToState(e);
  }
}
