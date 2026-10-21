import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notifications } from "@/db/schema";
import { requireAdmin } from "@/server/auth/session";
import { emailProviderConfigured } from "@/server/env";
import { whatsappLink } from "@/server/notifications";
import { getSettings } from "@/server/settings";
import { formatDateTime } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { Badge, Notice } from "@/components/ui/feedback";
import { setManualNotificationAction } from "../../_actions/notifications";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Notificações" };

const STATUS: Record<string, { label: string; tone: "success" | "danger" | "warning" | "neutral" | "info" }> = {
  sent: { label: "Enviado", tone: "success" },
  failed: { label: "Falhou", tone: "danger" },
  queued: { label: "Na fila", tone: "info" },
  manual_pending: { label: "Envio manual pendente", tone: "warning" },
  manual_done: { label: "Enviado manualmente", tone: "success" },
  dismissed: { label: "Descartado", tone: "neutral" },
};

export default async function NotificationsPage() {
  await requireAdmin();
  const db = getDb();
  const [pending, recent, { timezone: tz }] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.status, "manual_pending")).orderBy(desc(notifications.createdAt)).limit(100),
    db.select().from(notifications).where(ne(notifications.status, "manual_pending")).orderBy(desc(notifications.createdAt)).limit(50),
    getSettings(db, "booking"),
  ]);
  const emailOk = emailProviderConfigured();

  return (
    <>
      <PageHeader title="Notificações" description="Mensagens para clientes sobre solicitações, confirmações, alterações e lembretes." />
      {emailOk ? (
        <Notice tone="success" className="mb-6" title="E-mail configurado">
          Mensagens para clientes com e-mail são enviadas automaticamente pelo provedor (Resend).
        </Notice>
      ) : (
        <Notice tone="warning" className="mb-6" title="Envio automático não configurado">
          Defina <code>RESEND_API_KEY</code> e <code>EMAIL_FROM</code> nas variáveis de ambiente para enviar e-mails. Até lá, as mensagens ficam abaixo para envio
          manual pelo WhatsApp — nada é enviado automaticamente.
        </Notice>
      )}

      <Panel title={`Envio manual pendente (${pending.length})`}>
        {pending.length ? (
          <ul className="divide-y divide-ink-700">
            {pending.map((n) => {
              const isPhone = /^\d{10,13}$/.test(n.recipient);
              return (
                <li key={n.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-bone">{n.subject}</p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-mute">{n.body}</p>
                    <p className="mt-1 text-xs text-faint">
                      {formatDateTime(n.createdAt, tz)} · para {n.recipient} ·{" "}
                      <Link href={n.relatedType === "appointment" ? `/admin/agenda/${n.relatedId}` : `/admin/orcamentos/${n.relatedId}`} className="underline">
                        abrir
                      </Link>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                    {isPhone ? (
                      <a href={whatsappLink(n.recipient, n.body)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-sm bg-accent px-3 font-semibold text-accent-contrast">
                        Abrir no WhatsApp
                      </a>
                    ) : (
                      <a href={`mailto:${n.recipient}?subject=${encodeURIComponent(n.subject)}&body=${encodeURIComponent(n.body)}`} className="inline-flex min-h-9 items-center rounded-sm bg-accent px-3 font-semibold text-accent-contrast">
                        Abrir e-mail
                      </a>
                    )}
                    <form action={setManualNotificationAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="status" value="manual_done" />
                      <button className="min-h-9 rounded-sm border border-ink-600 px-3 hover:border-bone">Marcar como enviado</button>
                    </form>
                    <form action={setManualNotificationAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="status" value="dismissed" />
                      <button className="min-h-9 rounded-sm px-3 text-mute hover:text-bone">Descartar</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-mute">Nenhuma mensagem aguardando envio manual.</p>
        )}
      </Panel>

      <Panel title="Histórico recente" className="mt-6">
        {recent.length ? (
          <ul className="divide-y divide-ink-700 text-sm">
            {recent.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-bone-dim">
                  {n.subject} <span className="text-xs text-faint">· {n.recipient}</span>
                  {n.error ? <span className="block text-xs text-danger">{n.error}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-faint">{formatDateTime(n.createdAt, tz)}</span>
                  <Badge tone={STATUS[n.status]?.tone ?? "neutral"}>{STATUS[n.status]?.label ?? n.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mute">Nenhuma notificação registrada.</p>
        )}
      </Panel>
    </>
  );
}
