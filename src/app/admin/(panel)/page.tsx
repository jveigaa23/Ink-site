import Link from "next/link";
import { getDb } from "@/db/client";
import { getDashboard, getSetupChecklist } from "@/server/dashboard";
import { requireAdmin } from "@/server/auth/session";
import { addDaysLocal, formatLocalDate, formatTime, toLocalDate } from "@/lib/time";
import { PageHeader, Panel, Stat } from "@/components/admin/page-header";
import { AppointmentBadge } from "@/components/admin/status-badge";
import { VolumeChart } from "@/components/admin/volume-chart";
import { ButtonLink } from "@/components/ui/button";

const PERIODS = [7, 30, 90] as const;

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requireAdmin();
  const { periodo } = await searchParams;
  const periodDays = PERIODS.find((p) => String(p) === periodo) ?? 30;
  const db = getDb();
  const [d, checklist] = await Promise.all([getDashboard(db, { periodDays }), getSetupChecklist(db)]);
  const pendingSetup = checklist.filter((c) => !c.done);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysLocal(d.weekStartDate, i));

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={<span className="inline-block first-letter:uppercase">{formatLocalDate(d.today, { weekday: "long", day: "numeric", month: "long" })}</span>}
        actions={
          <>
            <ButtonLink href="/admin/agenda/novo" size="sm">
              Novo agendamento
            </ButtonLink>
            <ButtonLink href="/admin/bloqueios" size="sm" variant="secondary">
              Bloquear horário
            </ButtonLink>
          </>
        }
      />

      {pendingSetup.length ? (
        <Panel title={`Configuração inicial — ${pendingSetup.length} pendência(s)`} className="mb-8">
          <ul className="grid gap-2 sm:grid-cols-2">
            {pendingSetup.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className="flex items-start gap-2 text-sm text-bone-dim hover:text-bone">
                  <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-bone">Indicadores</h2>
        <nav aria-label="Período" className="flex gap-1 text-xs">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin?periodo=${p}`}
              aria-current={p === periodDays ? "page" : undefined}
              className={`rounded-sm px-2.5 py-1.5 ${p === periodDays ? "bg-ink-700 text-bone" : "text-mute hover:text-bone"}`}
            >
              {p} dias
            </Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sessões hoje" value={d.todayList.filter((a) => a.status !== "completed").length} href="/admin/agenda?view=dia" />
        <Stat label="Aguardando confirmação" value={d.counts.awaitingConfirmation} href="/admin/agenda?view=lista&status=pending" />
        <Stat label="Orçamentos pendentes" value={d.counts.pendingQuotes} href="/admin/orcamentos?status=open" />
        <Stat label="Avisos manuais" value={d.counts.manualNotifications} hint="mensagens a enviar" href="/admin/notificacoes" />
        <Stat label="Sessões concluídas" value={d.counts.completedInPeriod} hint={`últimos ${periodDays} dias`} />
        <Stat label="Cancelamentos" value={d.counts.cancelledInPeriod} hint={`últimos ${periodDays} dias`} />
        <Stat label="Pedidos de orçamento" value={d.counts.quotesInPeriod} hint={`últimos ${periodDays} dias`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Hoje">
          {d.todayList.length ? (
            <ul className="divide-y divide-ink-700">
              {d.todayList.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/agenda/${a.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-bone">
                    <span>
                      <span className="tabular-nums text-bone">{formatTime(a.startsAt, d.tz)}</span>
                      <span className="ml-3 text-bone-dim">{a.clientName ?? "—"}</span>
                      <span className="block text-xs text-faint">{a.serviceName}</span>
                    </span>
                    <AppointmentBadge status={a.status} reschedule={Boolean(a.rescheduledFromId)} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">Nenhuma sessão hoje.</p>
          )}
        </Panel>

        <Panel title="Próximas sessões" actions={<Link href="/admin/agenda?view=lista" className="text-xs text-mute hover:text-bone">Ver agenda</Link>}>
          {d.upcoming.length ? (
            <ul className="divide-y divide-ink-700">
              {d.upcoming.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/agenda/${a.id}`} className="flex items-center justify-between gap-3 py-3">
                    <span>
                      <span className="text-bone">
                        {formatLocalDate(toLocalDate(a.startsAt, d.tz), { weekday: "short", day: "2-digit", month: "2-digit" })} ·{" "}
                        {formatTime(a.startsAt, d.tz)}
                      </span>
                      <span className="block text-xs text-faint">
                        {a.clientName ?? "—"} · {a.serviceName}
                      </span>
                    </span>
                    <AppointmentBadge status={a.status} reschedule={Boolean(a.rescheduledFromId)} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">Nenhuma sessão futura agendada.</p>
          )}
        </Panel>
      </div>

      <Panel title="Semana atual" className="mt-6" actions={<Link href="/admin/agenda" className="text-xs text-mute hover:text-bone">Abrir agenda semanal</Link>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
          {weekDays.map((day) => {
            const items = d.week.filter((a) => toLocalDate(a.startsAt, d.tz) === day);
            return (
              <div key={day} className={`rounded-sm border p-2 ${day === d.today ? "border-bone/40" : "border-ink-700"}`}>
                <p className="mb-2 text-xs first-letter:uppercase text-mute">{formatLocalDate(day, { weekday: "short", day: "2-digit" })}</p>
                {items.length ? (
                  <ul className="space-y-1">
                    {items.map((a) => (
                      <li key={a.id}>
                        <Link href={`/admin/agenda/${a.id}`} className="block rounded-sm bg-ink-800 px-2 py-1 text-xs hover:bg-ink-700">
                          <span className="tabular-nums text-bone">{formatTime(a.startsAt, d.tz)}</span>{" "}
                          <span className="text-mute">{a.clientName?.split(" ")[0] ?? ""}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-faint">—</p>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Sessões por semana (confirmadas e concluídas)" className="mt-6">
        <VolumeChart data={d.volume} />
      </Panel>
    </>
  );
}
