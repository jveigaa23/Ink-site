import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth/session";
import { listAgenda, listAgendaPage } from "@/server/agenda";
import { listServices, getBusinessHours } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { appointmentStatus, type AppointmentStatus } from "@/db/schema";
import { APPOINTMENT_STATUS_SHORT } from "@/domain/status";
import {
  addDaysLocal,
  formatLocalDate,
  formatTime,
  isValidLocalDate,
  localMinuteOfDay,
  startOfLocalDay,
  startOfWeekLocal,
  toLocalDate,
} from "@/lib/time";
import { PageHeader } from "@/components/admin/page-header";
import { AppointmentBadge } from "@/components/admin/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pager } from "@/components/admin/pager";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Agenda" };

type SP = { view?: string; data?: string; status?: string; servico?: string; pagina?: string };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = getDb();
  const booking = await getSettings(db, "booking");
  const tz = booking.timezone;
  const view = sp.view === "dia" || sp.view === "lista" ? sp.view : "semana";
  const today = toLocalDate(new Date(), tz);
  const date = sp.data && isValidLocalDate(sp.data) ? sp.data : today;
  const statuses = (sp.status?.split(",").filter((s) => (appointmentStatus.enumValues as readonly string[]).includes(s)) ?? []) as AppointmentStatus[];
  const serviceId = sp.servico && /^[0-9a-f-]{36}$/.test(sp.servico) ? sp.servico : undefined;
  const [services, hours] = await Promise.all([listServices(db), getBusinessHours(db)]);

  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { view, data: date, status: sp.status, servico: sp.servico, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/admin/agenda?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Agenda"
        description={`Horários no fuso ${tz}.`}
        actions={
          <>
            <ButtonLink href="/admin/agenda/novo" size="sm">
              Novo agendamento
            </ButtonLink>
            <ButtonLink href="/admin/bloqueios" size="sm" variant="secondary">
              Bloqueios
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Visualização" className="flex gap-1 rounded-sm border border-ink-700 p-1 text-sm">
          {(["semana", "dia", "lista"] as const).map((v) => (
            <Link
              key={v}
              href={qs({ view: v, pagina: undefined })}
              aria-current={view === v ? "page" : undefined}
              className={`rounded-sm px-3 py-1.5 first-letter:uppercase ${view === v ? "bg-ink-700 text-bone" : "text-mute hover:text-bone"}`}
            >
              {v}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap items-end gap-2 text-sm" action="/admin/agenda">
          <input type="hidden" name="view" value={view} />
          {view !== "lista" ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-mute">Data</span>
              <input type="date" name="data" defaultValue={date} className="min-h-10 rounded-sm border border-ink-600 bg-ink-900 px-2" />
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-mute">Status</span>
            <select name="status" defaultValue={sp.status ?? ""} className="min-h-10 rounded-sm border border-ink-600 bg-ink-900 px-2">
              <option value="">Ativos</option>
              {(["pending", "confirmed", "completed", "cancelled", "no_show"] as const).map((s) => (
                <option key={s} value={s}>
                  {APPOINTMENT_STATUS_SHORT[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-mute">Serviço</span>
            <select name="servico" defaultValue={serviceId ?? ""} className="min-h-10 rounded-sm border border-ink-600 bg-ink-900 px-2">
              <option value="">Todos</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-10 rounded-sm border border-ink-600 px-3 hover:border-bone">
            Filtrar
          </button>
        </form>
      </div>

      {view === "lista" ? (
        <ListView statuses={statuses} serviceId={serviceId} tz={tz} page={Math.max(1, Number(sp.pagina) || 1)} qs={qs} />
      ) : (
        <GridView
          view={view}
          date={date}
          today={today}
          tz={tz}
          statuses={statuses}
          serviceId={serviceId}
          hours={hours}
          qs={qs}
        />
      )}
    </>
  );
}

async function ListView({
  statuses,
  serviceId,
  tz,
  page,
  qs,
}: {
  statuses: AppointmentStatus[];
  serviceId?: string;
  tz: string;
  page: number;
  qs: (p: Partial<SP>) => string;
}) {
  const db = getDb();
  const { rows, hasMore } = await listAgendaPage(db, { from: startOfLocalDay(toLocalDate(new Date(), tz), tz), statuses, serviceId, page });
  if (!rows.length) return <EmptyState title="Nada por aqui">Nenhum agendamento futuro com esses filtros.</EmptyState>;
  return (
    <>
      <div className="overflow-x-auto rounded-sm border border-ink-700">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wider text-mute">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Quando</th>
              <th scope="col" className="px-4 py-3 font-medium">Cliente</th>
              <th scope="col" className="px-4 py-3 font-medium">Serviço</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-ink-900">
                <td className="px-4 py-3 tabular-nums">
                  <span className="inline-block first-letter:uppercase">{formatLocalDate(toLocalDate(a.startsAt, tz), { weekday: "short", day: "2-digit", month: "2-digit" })}</span> ·{" "}
                  {formatTime(a.startsAt, tz)}
                </td>
                <td className="px-4 py-3">{a.clientName ?? "—"}</td>
                <td className="px-4 py-3 text-bone-dim">{a.serviceName}</td>
                <td className="px-4 py-3">
                  <AppointmentBadge status={a.status} reschedule={Boolean(a.rescheduledFromId)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/agenda/${a.id}`} className="text-bone underline-offset-4 hover:underline">
                    Abrir<span className="sr-only"> {a.protocol}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} hasMore={hasMore} href={(p) => qs({ pagina: String(p) })} />
    </>
  );
}

async function GridView({
  view,
  date,
  today,
  tz,
  statuses,
  serviceId,
  hours,
  qs,
}: {
  view: "semana" | "dia";
  date: string;
  today: string;
  tz: string;
  statuses: AppointmentStatus[];
  serviceId?: string;
  hours: { weekday: number; startMinute: number; endMinute: number }[];
  qs: (p: Partial<SP>) => string;
}) {
  const first = view === "semana" ? startOfWeekLocal(date) : date;
  const days = view === "semana" ? Array.from({ length: 7 }, (_, i) => addDaysLocal(first, i)) : [date];
  const from = startOfLocalDay(first, tz);
  const to = startOfLocalDay(addDaysLocal(first, days.length), tz);
  const { appts, blocks } = await listAgenda(getDb(), { from, to, statuses, serviceId });

  const minStart = Math.min(8 * 60, ...hours.map((h) => h.startMinute), ...appts.map((a) => localMinuteOfDay(a.startsAt, tz)));
  const maxEnd = Math.max(20 * 60, ...hours.map((h) => h.endMinute));
  const startHour = Math.floor(minStart / 60);
  const endHour = Math.min(24, Math.ceil(maxEnd / 60));
  const span = (endHour - startHour) * 60;
  const PX_PER_MIN = 1;
  const step = view === "semana" ? 7 : 1;

  const pos = (start: Date, end: Date, day: string) => {
    const dayStart = startOfLocalDay(day, tz).getTime();
    const s = Math.max(0, (start.getTime() - dayStart) / 60000 - startHour * 60);
    const e = Math.min(span, (end.getTime() - dayStart) / 60000 - startHour * 60);
    return { top: s * PX_PER_MIN, height: Math.max(22, (e - s) * PX_PER_MIN) };
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <Link href={qs({ data: addDaysLocal(date, -step) })} className="rounded-sm border border-ink-700 px-3 py-1.5 hover:border-bone">
          ← <span className="sr-only">Período anterior</span>
        </Link>
        <p className="font-medium first-letter:uppercase text-bone">
          {view === "semana"
            ? `${formatLocalDate(days[0], { day: "2-digit", month: "short" })} – ${formatLocalDate(days[6], { day: "2-digit", month: "short", year: "numeric" })}`
            : formatLocalDate(date, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <div className="flex gap-2">
          <Link href={qs({ data: today })} className="rounded-sm border border-ink-700 px-3 py-1.5 hover:border-bone">
            Hoje
          </Link>
          <Link href={qs({ data: addDaysLocal(date, step) })} className="rounded-sm border border-ink-700 px-3 py-1.5 hover:border-bone">
            → <span className="sr-only">Próximo período</span>
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-sm border border-ink-700">
        <div className={view === "semana" ? "min-w-[860px]" : ""}>
          <div className="grid border-b border-ink-700 bg-ink-900" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
            <div />
            {days.map((d) => (
              <Link
                key={d}
                href={qs({ view: "dia", data: d })}
                className={`border-l border-ink-700 px-2 py-2 text-xs first-letter:uppercase ${d === today ? "text-bone" : "text-mute"} hover:text-bone`}
              >
                {formatLocalDate(d, { weekday: "short", day: "2-digit", month: "2-digit" })}
              </Link>
            ))}
          </div>
          <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, height: span * PX_PER_MIN }}>
            <div className="relative">
              {Array.from({ length: endHour - startHour }, (_, i) => (
                <span key={i} className="absolute right-2 -translate-y-1/2 text-[0.65rem] tabular-nums text-faint" style={{ top: i * 60 * PX_PER_MIN }}>
                  {String(startHour + i).padStart(2, "0")}h
                </span>
              ))}
            </div>
            {days.map((d) => {
              const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
              const open = hours.filter((h) => h.weekday === wd);
              const dayAppts = appts.filter((a) => toLocalDate(a.startsAt, tz) === d);
              const dayStart = startOfLocalDay(d, tz);
              const dayEnd = startOfLocalDay(addDaysLocal(d, 1), tz);
              const dayBlocks = blocks.filter((b) => b.startsAt < dayEnd && b.endsAt > dayStart);
              return (
                <div key={d} className="relative border-l border-ink-700 bg-ink-950">
                  {Array.from({ length: endHour - startHour }, (_, i) => (
                    <div key={i} className="absolute inset-x-0 border-t border-ink-800" style={{ top: i * 60 * PX_PER_MIN }} />
                  ))}
                  {open.map((h) => (
                    <div
                      key={h.startMinute}
                      aria-hidden="true"
                      className="absolute inset-x-0 bg-ink-850"
                      style={{ top: (h.startMinute - startHour * 60) * PX_PER_MIN, height: (h.endMinute - h.startMinute) * PX_PER_MIN }}
                    />
                  ))}
                  {dayBlocks.map((b) => {
                    const p = pos(b.startsAt < dayStart ? dayStart : b.startsAt, b.endsAt > dayEnd ? dayEnd : b.endsAt, d);
                    return (
                      <div
                        key={b.id}
                        className="absolute inset-x-0 overflow-hidden bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(255_255_255/0.06)_6px_8px)] px-1.5 py-1 text-[0.65rem] text-faint"
                        style={p}
                        title={`Bloqueado${b.reason ? `: ${b.reason}` : ""}`}
                      >
                        Bloqueado{b.reason ? ` · ${b.reason}` : ""}
                      </div>
                    );
                  })}
                  {dayAppts.map((a) => {
                    const p = pos(a.startsAt, a.endsAt, d);
                    const tone =
                      a.status === "confirmed"
                        ? "border-success/70 bg-success/10"
                        : a.status === "pending"
                          ? "border-warning/70 bg-warning/10"
                          : "border-ink-600 bg-ink-800 opacity-70";
                    return (
                      <Link
                        key={a.id}
                        href={`/admin/agenda/${a.id}`}
                        className={`absolute inset-x-1 z-10 overflow-hidden rounded-sm border-l-2 px-1.5 py-1 text-xs hover:brightness-125 ${tone}`}
                        style={p}
                      >
                        <span className="block tabular-nums text-bone">
                          {formatTime(a.startsAt, tz)}–{formatTime(a.endsAt, tz)}
                        </span>
                        <span className="block truncate text-bone-dim">{a.clientName ?? "—"}</span>
                        <span className="block truncate text-faint">
                          {a.serviceName} · {APPOINTMENT_STATUS_SHORT[a.status]}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-3 flex flex-wrap gap-4 text-xs text-faint">
        <span><span aria-hidden="true" className="mr-1 inline-block size-2 bg-warning" />Aguardando confirmação</span>
        <span><span aria-hidden="true" className="mr-1 inline-block size-2 bg-success" />Confirmado</span>
        <span><span aria-hidden="true" className="mr-1 inline-block size-2 bg-ink-850 ring-1 ring-ink-600" />Expediente</span>
        <span>Faixas listradas: bloqueios</span>
      </p>
    </div>
  );
}
