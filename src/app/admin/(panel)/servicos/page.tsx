import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth/session";
import { listServices } from "@/server/catalog";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { ServiceForm } from "@/components/admin/service-form";
import { Badge } from "@/components/ui/feedback";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicesAdminPage() {
  await requireAdmin();
  const services = await listServices(getDb());
  return (
    <>
      <PageHeader title="Serviços" description="Tipos de atendimento, duração usada na agenda e exibição de preços. Não informe valores que o estúdio não pratica." />
      <div className="space-y-4">
        {services.map((s) => (
          <details key={s.id} className="group rounded-sm border border-ink-700 bg-ink-900">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="text-bone">{s.name} <span className="text-xs text-faint">· {s.durationMinutes} min</span></span>
              <span className="flex gap-2">
                {!s.active ? <Badge>Inativo</Badge> : null}
                {s.active && !s.bookableOnline ? <Badge>Só por orçamento</Badge> : null}
                <span aria-hidden="true" className="text-mute group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div className="border-t border-ink-700 p-4">
              <ServiceForm
                service={{
                  id: s.id,
                  name: s.name,
                  description: s.description,
                  durationMinutes: s.durationMinutes,
                  priceType: s.priceType,
                  price: s.priceCents != null ? (s.priceCents / 100).toFixed(2).replace(".", ",") : "",
                  bookableOnline: s.bookableOnline,
                  active: s.active,
                  sortOrder: s.sortOrder,
                }}
              />
            </div>
          </details>
        ))}
        <Panel title="Novo serviço">
          <ServiceForm />
        </Panel>
      </div>
    </>
  );
}
