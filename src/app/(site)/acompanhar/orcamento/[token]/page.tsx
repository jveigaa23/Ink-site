import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { getQuoteByToken } from "@/server/quotes/service";
import { getSettings } from "@/server/settings";
import { APPOINTMENT_STATUS_LABEL, QUOTE_STATUS_LABEL } from "@/domain/status";
import { formatCents } from "@/lib/money";
import { formatDateLong, formatDateShort, formatTime } from "@/lib/time";
import { SIZE_OPTIONS } from "@/lib/validation";
import { Container } from "@/components/site/section";
import { Badge, Notice, Paragraphs, Spinner } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Acompanhar orçamento", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ novo?: string }> };

export default function Page(props: Props) {
  return (
    <Container className="py-16 md:py-24">
      <Suspense fallback={<Spinner label="Carregando pedido" />}>
        <Content {...props} />
      </Suspense>
    </Container>
  );
}

async function Content({ params, searchParams }: Props) {
  await connection();
  const [{ token }, { novo }] = await Promise.all([params, searchParams]);
  const db = getDb();
  const view = await getQuoteByToken(db, token);
  if (!view) notFound();
  const { timezone: tz } = await getSettings(db, "booking");
  const q = view.quote;
  const estimate =
    q.estimateMinCents != null && q.estimateMaxCents != null && q.estimateMinCents !== q.estimateMaxCents
      ? `${formatCents(q.estimateMinCents)} a ${formatCents(q.estimateMaxCents)}`
      : q.estimateMinCents != null
        ? formatCents(q.estimateMinCents)
        : q.estimateMaxCents != null
          ? `até ${formatCents(q.estimateMaxCents)}`
          : null;
  const tone = q.status === "approved" ? "success" : q.status === "declined" ? "danger" : q.status === "archived" ? "neutral" : "warning";

  return (
    <div className="mx-auto max-w-3xl">
      {novo ? (
        <Notice tone="success" role="status" title="Pedido enviado" className="mb-10">
          Recebemos sua ideia. Guarde este link para acompanhar o andamento — não compartilhe, ele dá acesso ao seu pedido.
        </Notice>
      ) : null}
      <p className="eyebrow">Orçamento</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">{q.style}</h1>
      <p className="mt-4 text-mute">
        Protocolo <span className="font-semibold tracking-wider text-bone">{q.protocol}</span> · enviado em {formatDateShort(q.createdAt, tz)}
      </p>

      <div className="mt-10 border border-ink-700 bg-ink-900 p-6 sm:p-8">
        <Badge tone={tone}>{QUOTE_STATUS_LABEL[q.status]}</Badge>
        {q.messageToClient ? (
          <div className="mt-6">
            <h2 className="eyebrow mb-2">Mensagem do estúdio</h2>
            <Paragraphs text={q.messageToClient} className="leading-relaxed text-bone-dim" />
          </div>
        ) : (
          <p className="mt-6 text-sm text-mute">O estúdio vai analisar sua ideia e responder pelo contato informado.</p>
        )}
        {estimate ? (
          <p className="mt-6 text-bone">
            <span className="eyebrow mr-3">Estimativa</span>
            {estimate}
          </p>
        ) : null}
        {q.proposedSlots.length && !view.appointment ? (
          <div className="mt-6">
            <h2 className="eyebrow mb-2">Datas sugeridas</h2>
            <ul className="space-y-1 text-bone-dim">
              {q.proposedSlots.map((s) => (
                <li key={s.startsAt}>
                  <span className="capitalize">{formatDateLong(new Date(s.startsAt), tz)}</span>, {formatTime(new Date(s.startsAt), tz)}
                  {s.note ? <span className="text-faint"> — {s.note}</span> : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-faint">Responda ao estúdio pelo canal de contato para escolher uma das datas.</p>
          </div>
        ) : null}
        {view.appointment ? (
          <div className="mt-8 border-t border-ink-700 pt-6">
            <h2 className="eyebrow mb-2">Sessão agendada</h2>
            <p className="text-lg capitalize text-bone">{formatDateLong(view.appointment.appt.startsAt, tz)}, {formatTime(view.appointment.appt.startsAt, tz)}</p>
            <p className="text-sm text-mute">
              {view.appointment.serviceName} · {APPOINTMENT_STATUS_LABEL[view.appointment.appt.status]}
            </p>
            <p className="mt-2 text-xs text-faint">Para remarcar ou cancelar, fale com o estúdio.</p>
          </div>
        ) : null}
      </div>

      <dl className="mt-10 grid gap-6 text-sm sm:grid-cols-3">
        <div>
          <dt className="eyebrow mb-1">Local</dt>
          <dd className="text-bone-dim">{q.bodyPart}</dd>
        </div>
        <div>
          <dt className="eyebrow mb-1">Tamanho</dt>
          <dd className="text-bone-dim">{SIZE_OPTIONS.find((o) => o.value === q.size)?.label ?? q.size}</dd>
        </div>
        <div>
          <dt className="eyebrow mb-1">Referências</dt>
          <dd className="text-bone-dim">{view.referenceCount ? `${view.referenceCount} imagem(ns)` : "Nenhuma"}</dd>
        </div>
      </dl>
      <div className="mt-6">
        <h2 className="eyebrow mb-2">Sua descrição</h2>
        <Paragraphs text={q.description} className="leading-relaxed text-mute" />
      </div>
      <ButtonLink href="/" variant="ghost" className="mt-12">
        Voltar ao site
      </ButtonLink>
    </div>
  );
}
