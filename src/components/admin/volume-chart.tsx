import { formatLocalDate } from "@/lib/time";

/**
 * Barras de série única (sessões por semana). Rótulo de valor visível acima de cada barra,
 * dica nativa ao passar o mouse e tabela equivalente para leitores de tela.
 */
export function VolumeChart({ data }: { data: { week: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const label = (w: string) => formatLocalDate(w, { day: "2-digit", month: "2-digit" });
  return (
    <figure>
      <div aria-hidden="true" className="flex h-40 items-end gap-2 border-b border-ink-600 sm:gap-3">
        {data.map((d) => (
          <div key={d.week} className="group flex h-full flex-1 flex-col items-center justify-end" title={`Semana de ${label(d.week)}: ${d.count} sessão(ões)`}>
            <span className="mb-1 text-xs tabular-nums text-mute group-hover:text-bone">{d.count}</span>
            <div
              className="w-full max-w-10 rounded-t-[4px] bg-bone-dim/70 transition-colors group-hover:bg-bone"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 0 }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-2 flex gap-2 sm:gap-3">
        {data.map((d) => (
          <span key={d.week} className="flex-1 text-center text-[0.65rem] tabular-nums text-faint">
            {label(d.week)}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">Sessões confirmadas ou concluídas por semana, últimas 8 semanas.</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Semana iniciada em</th>
            <th>Sessões</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.week}>
              <td>{label(d.week)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
