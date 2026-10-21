import { and, asc, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import {
  adminUsers,
  appointments,
  businessHours,
  clients,
  notifications,
  portfolioItems,
  quoteRequests,
  services,
} from "@/db/schema";
import type { DbLike } from "@/db/types";
import { addDaysLocal, startOfLocalDay, startOfWeekLocal, toLocalDate } from "@/lib/time";
import { emailProviderConfigured, env } from "@/server/env";
import { getSettings } from "@/server/settings";

/** Indicadores calculados exclusivamente a partir dos dados reais. */
export async function getDashboard(db: DbLike, opts: { periodDays: number; now?: Date }) {
  const now = opts.now ?? new Date();
  const booking = await getSettings(db, "booking");
  const tz = booking.timezone;
  const today = toLocalDate(now, tz);
  const dayStart = startOfLocalDay(today, tz);
  const dayEnd = startOfLocalDay(addDaysLocal(today, 1), tz);
  const weekStartDate = startOfWeekLocal(today);
  const weekStart = startOfLocalDay(weekStartDate, tz);
  const weekEnd = startOfLocalDay(addDaysLocal(weekStartDate, 7), tz);
  const periodStart = new Date(now.getTime() - opts.periodDays * 86_400_000);

  const apptCols = {
    id: appointments.id,
    protocol: appointments.protocol,
    status: appointments.status,
    startsAt: appointments.startsAt,
    endsAt: appointments.endsAt,
    serviceName: services.name,
    clientName: clients.name,
    rescheduledFromId: appointments.rescheduledFromId,
  };
  const activeOrDone = inArray(appointments.status, ["pending", "confirmed", "completed"]);

  const [todayList, upcoming, week, pendingQuotes, awaiting, cancelled, completed, manualPending, weeklyVolume, quotesInPeriod] =
    await Promise.all([
      db
        .select(apptCols)
        .from(appointments)
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .leftJoin(clients, eq(clients.id, appointments.clientId))
        .where(and(activeOrDone, gte(appointments.startsAt, dayStart), lt(appointments.startsAt, dayEnd)))
        .orderBy(asc(appointments.startsAt)),
      db
        .select(apptCols)
        .from(appointments)
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .leftJoin(clients, eq(clients.id, appointments.clientId))
        .where(and(inArray(appointments.status, ["pending", "confirmed"]), gte(appointments.startsAt, dayEnd)))
        .orderBy(asc(appointments.startsAt))
        .limit(8),
      db
        .select(apptCols)
        .from(appointments)
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .leftJoin(clients, eq(clients.id, appointments.clientId))
        .where(and(activeOrDone, gte(appointments.startsAt, weekStart), lt(appointments.startsAt, weekEnd)))
        .orderBy(asc(appointments.startsAt)),
      db
        .select({ n: count() })
        .from(quoteRequests)
        .where(inArray(quoteRequests.status, ["received", "in_review"])),
      db
        .select({ n: count() })
        .from(appointments)
        .where(and(eq(appointments.status, "pending"), gte(appointments.startsAt, now))),
      db
        .select({ n: count() })
        .from(appointments)
        .where(and(eq(appointments.status, "cancelled"), gte(appointments.cancelledAt, periodStart))),
      db
        .select({ n: count() })
        .from(appointments)
        .where(and(eq(appointments.status, "completed"), gte(appointments.startsAt, periodStart), lt(appointments.startsAt, now))),
      db.select({ n: count() }).from(notifications).where(eq(notifications.status, "manual_pending")),
      // sessões (confirmadas ou concluídas) por semana nas últimas 8 semanas, no fuso do estúdio
      db.execute<{ week: string; n: number }>(sql`
        select to_char(date_trunc('week', ${appointments.startsAt} at time zone ${tz}), 'YYYY-MM-DD') as week,
               count(*)::int as n
        from ${appointments}
        where ${appointments.status} in ('confirmed', 'completed')
          and ${appointments.startsAt} >= ${startOfLocalDay(addDaysLocal(weekStartDate, -49), tz).toISOString()}::timestamptz
          and ${appointments.startsAt} < ${weekEnd.toISOString()}::timestamptz
        group by 1 order by 1`),
      db.select({ n: count() }).from(quoteRequests).where(gte(quoteRequests.createdAt, periodStart)),
    ]);

  const volumeMap = new Map(Array.from(weeklyVolume).map((r) => [r.week, Number(r.n)]));
  const volume = Array.from({ length: 8 }, (_, i) => {
    const wk = addDaysLocal(weekStartDate, (i - 7) * 7);
    return { week: wk, count: volumeMap.get(wk) ?? 0 };
  });

  return {
    tz,
    today,
    weekStartDate,
    todayList,
    upcoming,
    week,
    volume,
    counts: {
      pendingQuotes: pendingQuotes[0].n,
      awaitingConfirmation: awaiting[0].n,
      cancelledInPeriod: cancelled[0].n,
      completedInPeriod: completed[0].n,
      quotesInPeriod: quotesInPeriod[0].n,
      manualNotifications: manualPending[0].n,
    },
  };
}

/** Pendências de configuração para colocar o site em produção com dados reais. */
export async function getSetupChecklist(db: DbLike) {
  const [studio, notif, [hours], [svc], [works], [demo], [admins]] = await Promise.all([
    getSettings(db, "studio"),
    getSettings(db, "notifications"),
    db.select({ n: count() }).from(businessHours),
    db.select({ n: count() }).from(services).where(eq(services.active, true)),
    db.select({ n: count() }).from(portfolioItems).where(and(eq(portfolioItems.published, true), eq(portfolioItems.isDemo, false))),
    db.select({ n: count() }).from(portfolioItems).where(eq(portfolioItems.isDemo, true)),
    db.select({ n: count() }).from(adminUsers),
  ]);
  const c = studio.contact;
  return [
    { done: !studio.namePending, label: "Definir o nome comercial do estúdio", href: "/admin/configuracoes" },
    { done: hours.n > 0, label: "Cadastrar o horário de atendimento", href: "/admin/configuracoes?aba=agenda" },
    { done: svc.n > 0, label: "Cadastrar ao menos um serviço", href: "/admin/servicos" },
    { done: Boolean(c.instagram || c.whatsapp || c.email), label: "Informar canais oficiais (Instagram, WhatsApp ou e-mail)", href: "/admin/configuracoes?aba=contato" },
    { done: Boolean(studio.artistBio), label: "Escrever a biografia do artista", href: "/admin/configuracoes?aba=conteudo" },
    { done: works.n > 0, label: "Publicar fotografias reais no portfólio", href: "/admin/portfolio" },
    { done: demo.n === 0, label: "Remover imagens demonstrativas do portfólio", href: "/admin/portfolio" },
    { done: Boolean(studio.aftercare), label: "Publicar orientações de cuidados", href: "/admin/configuracoes?aba=conteudo" },
    { done: emailProviderConfigured(), label: "Configurar envio de e-mails (RESEND_API_KEY e EMAIL_FROM)", href: "/admin/notificacoes" },
    { done: Boolean(notif.adminEmail), label: "Informar e-mail para avisos de novas solicitações", href: "/admin/configuracoes?aba=notificacoes" },
    { done: Boolean(env.blobPublicToken() && env.blobPrivateToken()), label: "Configurar armazenamento de imagens (Vercel Blob)", href: "/admin/configuracoes" },
    { done: admins.n > 0, label: "Administrador criado", href: "/admin" },
  ];
}
