import { and, eq, inArray, lt } from "drizzle-orm";
import { notifications, type NotificationRow } from "@/db/schema";
import type { DbLike } from "@/db/types";
import { emailProviderConfigured, env } from "@/server/env";
import { getSettings } from "@/server/settings";
import { sendEmail } from "./resend";

/**
 * Notificações via “outbox” no banco:
 * 1. A mensagem é registrada (idempotente por `dedupeKey`).
 * 2. Com provedor de e-mail configurado, é enviada de verdade e marcada como `sent`/`failed`.
 * 3. Sem provedor (ou sem e-mail do cliente), fica como `manual_pending` e aparece no painel
 *    com um link de WhatsApp pronto para o estúdio enviar manualmente.
 * Nenhum envio é simulado.
 */

export type NotifyInput = {
  template: string;
  relatedType: "appointment" | "quote";
  relatedId: string;
  dedupeKey: string;
  subject: string;
  body: string;
  email?: string | null;
  phone?: string | null;
  /** Link secreto: anexado apenas no envio imediato, nunca persistido. */
  secretLink?: string;
  /** Sem provedor de e-mail, registrar pendência de envio manual (padrão: sim). */
  manualFallback?: boolean;
};

export type QueuedNotification = { id: string; secretLink?: string };

export async function enqueueNotification(db: DbLike, input: NotifyInput): Promise<QueuedNotification[]> {
  const prefs = await getSettings(db, "notifications");
  const emailOk = Boolean(input.email) && prefs.emailEnabled && emailProviderConfigured();
  const out: QueuedNotification[] = [];

  if (emailOk && input.email) {
    const [row] = await db
      .insert(notifications)
      .values({
        channel: "email",
        template: input.template,
        recipient: input.email,
        subject: input.subject,
        body: input.body,
        status: "queued",
        relatedType: input.relatedType,
        relatedId: input.relatedId,
        dedupeKey: `${input.dedupeKey}:email`,
      })
      .onConflictDoNothing({ target: notifications.dedupeKey })
      .returning({ id: notifications.id });
    if (row) out.push({ id: row.id, secretLink: input.secretLink });
  } else if (input.manualFallback !== false && (input.phone || input.email)) {
    await db
      .insert(notifications)
      .values({
        channel: "whatsapp_manual",
        template: input.template,
        recipient: input.phone || input.email || "",
        subject: input.subject,
        body: input.body,
        status: "manual_pending",
        relatedType: input.relatedType,
        relatedId: input.relatedId,
        dedupeKey: `${input.dedupeKey}:manual`,
      })
      .onConflictDoNothing({ target: notifications.dedupeKey });
  }
  return out;
}

/** Envia notificações de e-mail enfileiradas. Chamado após o commit da transação. */
export async function dispatchQueued(db: DbLike, queued: QueuedNotification[]) {
  if (!queued.length || !emailProviderConfigured()) return;
  const rows = await db
    .select()
    .from(notifications)
    .where(and(inArray(notifications.id, queued.map((q) => q.id)), inArray(notifications.status, ["queued", "failed"])));
  const links = new Map(queued.map((q) => [q.id, q.secretLink]));
  for (const row of rows) await deliver(db, row, links.get(row.id));
}

async function deliver(db: DbLike, row: NotificationRow, secretLink?: string) {
  const studio = await getSettings(db, "studio");
  const text = secretLink
    ? `${row.body}\n\nAcompanhe ou gerencie pelo link (não compartilhe):\n${secretLink}`
    : `${row.body}\n\nPara acompanhar, acesse ${env.appUrl}/acompanhar e informe seu protocolo.`;
  try {
    const res = await sendEmail({
      to: row.recipient,
      subject: row.subject,
      text: `${text}\n\n— ${studio.name}`,
      fromName: studio.name,
    });
    await db
      .update(notifications)
      .set({ status: "sent", sentAt: new Date(), attempts: row.attempts + 1, providerMessageId: res.id, error: null })
      .where(eq(notifications.id, row.id));
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 300) : "erro desconhecido";
    await db
      .update(notifications)
      .set({ status: "failed", attempts: row.attempts + 1, error: msg })
      .where(eq(notifications.id, row.id));
    console.error(`[notifications] falha ao enviar ${row.id}: ${msg}`);
  }
}

/** Reprocessa falhas (até 3 tentativas). Usado pela rotina agendada. */
export async function retryFailed(db: DbLike) {
  if (!emailProviderConfigured()) return 0;
  const rows = await db
    .select()
    .from(notifications)
    .where(and(inArray(notifications.status, ["failed", "queued"]), lt(notifications.attempts, 3)))
    .limit(50);
  for (const row of rows) await deliver(db, row);
  return rows.length;
}

export async function setManualStatus(db: DbLike, id: string, status: "manual_done" | "dismissed" | "manual_pending") {
  await db.update(notifications).set({ status }).where(eq(notifications.id, id));
}

/** Link “click to chat” do WhatsApp com a mensagem pronta (envio feito pelo próprio estúdio). */
export function whatsappLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}
