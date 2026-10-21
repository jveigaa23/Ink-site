import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth/session";
import { listCategories } from "@/server/portfolio/service";
import { PageHeader } from "@/components/admin/page-header";
import { PortfolioForm } from "@/components/admin/portfolio-form";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Novo trabalho" };

export default async function NewWorkPage() {
  await requireAdmin();
  const categories = await listCategories(getDb());
  return (
    <>
      <PageHeader title="Novo trabalho" />
      <PortfolioForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
    </>
  );
}
