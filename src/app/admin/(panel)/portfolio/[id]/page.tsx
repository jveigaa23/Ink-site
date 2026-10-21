import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth/session";
import { getItem, listCategories } from "@/server/portfolio/service";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { PortfolioForm } from "@/components/admin/portfolio-form";
import { Notice } from "@/components/ui/feedback";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { deletePortfolioAction } from "../../../_actions/portfolio";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Editar trabalho" };

export default async function EditWorkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  await requireAdmin();
  const [{ id }, { salvo }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [item, categories] = await Promise.all([getItem(db, id), listCategories(db)]);
  if (!item) notFound();
  return (
    <>
      <Link href="/admin/portfolio" className="mb-4 inline-block text-sm text-mute hover:text-bone">← Portfólio</Link>
      <PageHeader
        title={item.title}
        actions={item.published ? <Link href={`/portfolio/${item.slug}`} target="_blank" className="text-sm text-bone-dim underline underline-offset-4">Ver no site</Link> : null}
      />
      {salvo ? <Notice tone="success" role="status" className="mb-6">Trabalho adicionado.</Notice> : null}
      <PortfolioForm
        item={{ id: item.id, title: item.title, description: item.description, altText: item.altText, categoryId: item.categoryId, featured: item.featured, published: item.published, isDemo: item.isDemo, imageUrl: item.imageUrl }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
      <Panel title="Excluir" className="mt-10">
        <form action={deletePortfolioAction}>
          <input type="hidden" name="id" value={item.id} />
          <ConfirmSubmit message="Excluir este trabalho e o arquivo de imagem definitivamente?">Excluir trabalho</ConfirmSubmit>
        </form>
      </Panel>
    </>
  );
}
