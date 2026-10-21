"use client";

import { useEffect, useMemo, useState } from "react";
import { addDaysLocal, weekdayOf, formatLocalDate } from "@/lib/time";
import { Spinner } from "@/components/ui/feedback";

export type SlotOption = { startsAt: string; endsAt: string; label: string };

export type PickerConfig = {
  timezone: string;
  maxAdvanceDays: number;
  openWeekdays: number[];
};

function todayIn(timezone: string) {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

type Load = { state: "idle" | "loading" | "error"; slots: SlotOption[]; message?: string; reason?: string | null };

/**
 * Seleção de data e horário. Exibe somente horários retornados pelo servidor;
 * a disponibilidade final é revalidada ao reservar.
 */
export function SlotPicker({
  serviceId,
  config,
  onSelect,
  disabled,
  selected,
}: {
  serviceId: string;
  config: PickerConfig;
  onSelect: (slot: SlotOption, date: string) => void;
  disabled?: boolean;
  selected?: string | null;
}) {
  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>({ state: "idle", slots: [] });
  const [reloadKey, setReloadKey] = useState(0);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- a data atual só é conhecida no navegador
  useEffect(() => setToday(todayIn(config.timezone)), [config.timezone]);

  const dates = useMemo(() => {
    if (!today) return [];
    const out: string[] = [];
    for (let i = 0; i <= config.maxAdvanceDays; i++) {
      const d = addDaysLocal(today, i);
      if (config.openWeekdays.includes(weekdayOf(d))) out.push(d);
    }
    return out;
  }, [today, config.maxAdvanceDays, config.openWeekdays]);

  useEffect(() => {
    if (!date) return;
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carregamento da busca
    setLoad({ state: "loading", slots: [] });
    fetch(`/api/availability?serviceId=${encodeURIComponent(serviceId)}&date=${date}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Erro ao consultar horários.");
        setLoad({ state: "idle", slots: body.slots, reason: body.reason });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLoad({ state: "error", slots: [], message: e.message });
      });
    return () => ctrl.abort();
  }, [date, serviceId, reloadKey]);

  if (!today) return <Spinner label="Carregando calendário" />;
  if (!dates.length) {
    return <p className="text-mute">Não há dias de atendimento disponíveis para agendamento online no momento.</p>;
  }

  // agrupa por mês para a faixa de datas
  const months = dates.reduce<Record<string, string[]>>((acc, d) => {
    const k = d.slice(0, 7);
    (acc[k] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-sm font-medium text-bone-dim" id="date-label">
          Escolha uma data
        </h3>
        <div role="group" aria-labelledby="date-label" className="-mx-4 flex gap-6 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {Object.entries(months).map(([month, days]) => (
            <div key={month} className="shrink-0">
              <p className="eyebrow mb-2 capitalize">{formatLocalDate(`${month}-01`, { month: "long", year: "numeric" })}</p>
              <div className="flex gap-2">
                {days.map((d) => {
                  const active = d === date;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={disabled}
                      aria-pressed={active}
                      aria-label={formatLocalDate(d, { weekday: "long", day: "numeric", month: "long" })}
                      onClick={() => setDate(d)}
                      className={`flex h-18 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-sm border transition-colors ${
                        active ? "border-bone bg-bone text-ink-950" : "border-ink-600 text-bone-dim hover:border-bone/60 hover:text-bone"
                      }`}
                    >
                      <span className="text-[0.65rem] uppercase tracking-wider">{formatLocalDate(d, { weekday: "short" }).replace(".", "")}</span>
                      <span className="text-xl tabular-nums">{Number(d.slice(8))}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {date ? (
        <div aria-live="polite">
          <h3 className="mb-3 text-sm font-medium text-bone-dim">
            Horários em <span className="text-bone">{formatLocalDate(date)}</span>
          </h3>
          {load.state === "loading" ? (
            <Spinner label="Consultando agenda" />
          ) : load.state === "error" ? (
            <div className="flex items-center gap-4">
              <p className="text-sm text-danger" role="alert">
                {load.message}
              </p>
              <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="text-sm text-bone underline underline-offset-4">
                Tentar novamente
              </button>
            </div>
          ) : load.slots.length ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {load.slots.map((s) => (
                <li key={s.startsAt}>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected === s.startsAt}
                    onClick={() => onSelect(s, date)}
                    className={`min-h-12 w-full rounded-sm border text-base tabular-nums transition-colors ${
                      selected === s.startsAt ? "border-accent bg-accent text-accent-contrast" : "border-ink-600 text-bone hover:border-bone"
                    }`}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-l-2 border-ink-600 pl-3 text-sm text-mute">
              {load.reason === "beyond_horizon"
                ? "Esta data ainda não está aberta para agendamento."
                : "Sem horários disponíveis nesta data. Tente outro dia."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
