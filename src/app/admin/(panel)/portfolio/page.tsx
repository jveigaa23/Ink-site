import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth/session";
import { listAllItems, listCategories } from "@/server/portfolio/service";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { ActionForm } from "@/components/admin/action-form";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";
import { deleteCategoryAction, movePortfolioAction, saveCategoryAction, togglePortfolioAction } from "../../_actions/portfolio";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Portfólio" };

export default async function PortfolioAdminPage() {
  await requireAdmin();
  const db = getDb();
  const [items, categories] = await Promise.all([listAllItems(db), listCategories(db)]);
  const demoCount = items.filter((i) => i.item.isDemo).length;

  return (
    <>
      <PageHeader
        title="Portfólio"
        description="A ordem abaixo é a ordem do site (destaques aparecem primeiro)."
        actions={<ButtonLink href="/admin/portfolio/novo" size="sm">Adicionar trabalho</ButtonLink>}
      />
      {demoCount ? (
        <p className="mb-6 border-l-2 border-warning/60 pl-3 text-sm text-warning">
          {demoCount} imagem(ns) demonstrativa(s). Substitua por fotografias reais antes de divulgar o site.
        </p>
      ) : null}

      {items.length ? (
        <ol className="divide-y divide-ink-700 rounded-sm border border-ink-700">
          {items.map(({ item, category }, idx) => (
            <li key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 sm:flex-1">
                <div className="relative size-16 shrink-0 overflow-hidden bg-ink-850">
                  <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <Link href={`/admin/portfolio/${item.id}`} className="block truncate text-bone hover:underline">
                    {item.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {item.published ? <Badge tone="success">Publicado</Badge> : <Badge>Rascunho</Badge>}
                    {item.featured ? <Badge tone="info">Destaque</Badge> : null}
                    {item.isDemo ? <Badge tone="warning">Demonstrativa</Badge> : null}
                    {category ? <span className="text-xs text-faint">{category.name}</span> : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <form action={movePortfolioAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button disabled={idx === 0} className="min-h-9 rounded-sm border border-ink-700 px-2.5 disabled:opacity-30" aria-label={`Mover ${item.title} para cima`}>↑</button>
                </form>
                <form action={movePortfolioAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button disabled={idx === items.length - 1} className="min-h-9 rounded-sm border border-ink-700 px-2.5 disabled:opacity-30" aria-label={`Mover ${item.title} para baixo`}>↓</button>
                </form>
                <form action={togglePortfolioAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="field" value="published" />
                  <input type="hidden" name="value" value={item.published ? "0" : "1"} />
                  <button className="min-h-9 rounded-sm border border-ink-700 px-2.5 hover:border-bone">{item.published ? "Despublicar" : "Publicar"}</button>
                </form>
                <form action={togglePortfolioAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="field" value="featured" />
                  <input type="hidden" name="value" value={item.featured ? "0" : "1"} />
                  <button className="min-h-9 rounded-sm border border-ink-700 px-2.5 hover:border-bone">{item.featured ? "Tirar destaque" : "Destacar"}</button>
                </form>
                <Link href={`/admin/portfolio/${item.id}`} className="inline-flex min-h-9 items-center rounded-sm border border-ink-700 px-2.5 hover:border-bone">
                  Editar
                </Link>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="Portfólio vazio" action={<ButtonLink href="/admin/portfolio/novo">Adicionar o primeiro trabalho</ButtonLink>}>
          Adicione fotografias reais dos trabalhos. Elas só aparecem no site depois de publicadas.
        </EmptyState>
      )}

      <Panel title="Categorias / estilos" className="mt-8">
        {categories.length ? (
          <ul className="mb-6 divide-y divide-ink-700">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-bone-dim">{c.name}</span>
                <form action={deleteCategoryAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs text-danger hover:underline">Excluir<span className="sr-only"> categoria {c.name}</span></button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <ActionForm action={saveCategoryAction} submitLabel="Adicionar categoria" variant="secondary" size="sm" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-3">
              <TextField label="Nome" name="name" required />
              <TextField label="Descrição (opcional)" name="description" />
              <TextField label="Ordem" name="sortOrder" type="number" min={0} defaultValue={categories.length + 1} />
            </div>
        </ActionForm>
      </Panel>
    </>
  );
}
