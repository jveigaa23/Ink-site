"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { portfolioItems } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { isNextControlFlow, toErrorState, type ActionState } from "@/server/action-result";
import { requireAdmin } from "@/server/auth/session";
import { TAGS } from "@/server/cache-tags";
import { createItem, deleteCategory, deleteItem, moveItem, saveCategory, updateItem } from "@/server/portfolio/service";
import { audit } from "@/server/audit";

const fieldsSchema = z.object({
  title: z.string().trim().min(2, "Informe um título.").max(120),
  description: z.string().trim().max(2000),
  altText: z.string().trim().min(10, "Descreva a imagem (mín. 10 caracteres) para acessibilidade.").max(300),
  categoryId: z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null),
});

function readFields(fd: FormData) {
  const base = fieldsSchema.parse({
    title: fd.get("title"),
    description: fd.get("description") ?? "",
    altText: fd.get("altText"),
    categoryId: fd.get("categoryId") ?? "",
  });
  return { ...base, featured: fd.get("featured") === "on", published: fd.get("published") === "on", isDemo: fd.get("isDemo") === "on" };
}

export async function createPortfolioAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const admin = await requireAdmin();
    const file = fd.get("image");
    if (!(file instanceof File) || file.size === 0) throw new AppError("INVALID", "Selecione uma imagem.", 400, { image: "Selecione uma imagem." });
    const item = await createItem(getDb(), { fields: readFields(fd), file, actor: { type: "admin", id: admin.id } });
    updateTag(TAGS.portfolio);
    id = item.id;
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
  redirect(`/admin/portfolio/${id}?salvo=1`);
}

export async function updatePortfolioAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const file = fd.get("image");
    await updateItem(getDb(), {
      id: z.string().uuid().parse(fd.get("id")),
      fields: readFields(fd),
      file: file instanceof File && file.size > 0 ? file : null,
      actor: { type: "admin", id: admin.id },
    });
    updateTag(TAGS.portfolio);
    return { status: "success", message: "Trabalho salvo." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}

export async function deletePortfolioAction(fd: FormData) {
  const admin = await requireAdmin();
  await deleteItem(getDb(), z.string().uuid().parse(fd.get("id")), { type: "admin", id: admin.id });
  updateTag(TAGS.portfolio);
  redirect("/admin/portfolio");
}

export async function togglePortfolioAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(fd.get("id"));
  const field = z.enum(["published", "featured"]).parse(fd.get("field"));
  const value = fd.get("value") === "1";
  const db = getDb();
  await db
    .update(portfolioItems)
    .set(field === "published" ? { published: value, publishedAt: value ? new Date() : null } : { featured: value })
    .where(eq(portfolioItems.id, id));
  await audit(db, { type: "admin", id: admin.id }, "portfolio.updated", { type: "portfolio", id }, { [field]: value });
  updateTag(TAGS.portfolio);
}

export async function movePortfolioAction(fd: FormData) {
  await requireAdmin();
  await moveItem(getDb(), z.string().uuid().parse(fd.get("id")), z.enum(["up", "down"]).parse(fd.get("dir")));
  updateTag(TAGS.portfolio);
}

export async function saveCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    await saveCategory(getDb(), {
      id: (fd.get("id") as string) || undefined,
      name: z.string().trim().min(2, "Informe o nome.").max(40).parse(fd.get("name")),
      description: z.string().trim().max(300).parse(fd.get("description") ?? ""),
      sortOrder: z.coerce.number().int().min(0).max(999).parse(fd.get("sortOrder") || 0),
    });
    updateTag(TAGS.portfolio);
    return { status: "success", message: "Categoria salva." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}

export async function deleteCategoryAction(fd: FormData) {
  await requireAdmin();
  await deleteCategory(getDb(), z.string().uuid().parse(fd.get("id")));
  updateTag(TAGS.portfolio);
}
