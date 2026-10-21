import { formatDateTime } from "@/lib/time";

const ACTIONS: Record<string, string> = {
  "appointment.requested": "Solicitação enviada pelo cliente",
  "appointment.created": "Criado no painel",
  "appointment.status": "Status alterado",
  "appointment.rescheduled": "Remarcado",
  "appointment.cancelled": "Cancelado pelo cliente",
  "appointment.deposit": "Sinal atualizado",
  "quote.created": "Pedido recebido",
  "quote.updated": "Pedido atualizado",
  "quote.converted": "Convertido em agendamento",
  "client.notes": "Observações atualizadas",
  "client.anonymized": "Dados excluídos a pedido do titular",
};

const STATUS: Record<string, string> = {
  pending: "aguardando", confirmed: "confirmado", completed: "concluído", cancelled: "cancelado", no_show: "não compareceu",
  received: "recebida", in_review: "em análise", awaiting_client: "aguardando cliente", approved: "aprovada", declined: "recusada", archived: "arquivada",
};

function describe(action: string, data: Record<string, unknown> | null) {
  const base = ACTIONS[action] ?? action;
  if (!data) return base;
  const st = data.status as { from?: string; to?: string } | undefined;
  if (action === "appointment.status" && typeof data.from === "string" && typeof data.to === "string") {
    return `${base}: ${STATUS[data.from] ?? data.from} → ${STATUS[data.to] ?? data.to}`;
  }
  if (st?.from && st?.to) return `${base}: ${STATUS[st.from] ?? st.from} → ${STATUS[st.to] ?? st.to}`;
  return base;
}

export function HistoryList({
  entries,
  tz,
}: {
  entries: { id: number; action: string; actorType: string; data: Record<string, unknown> | null; createdAt: Date }[];
  tz: string;
}) {
  if (!entries.length) return <p className="text-sm text-mute">Sem registros.</p>;
  return (
    <ol className="space-y-3 text-sm">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-600" />
          <div>
            <p className="text-bone-dim">{describe(e.action, e.data)}</p>
            <p className="text-xs text-faint">
              {formatDateTime(e.createdAt, tz)} · {e.actorType === "admin" ? "estúdio" : e.actorType === "client" ? "cliente" : "sistema"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
