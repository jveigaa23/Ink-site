import { and, asc, desc, eq, sql } from "drizzle-orm";
import { portfolioCategories, portfolioItems } from "@/db/schema";
import type { DbLike } from "@/db/types";
import { AppError, PG_UNIQUE_VIOLATION, pgErrorCode } from "@/lib/errors";
import { generateToken } from "@/lib/crypto";
import { slugify } from "@/lib/slug";
import { audit, type Actor } from "@/server/audit";
import { deleteObject, putObject } from "@/server/storage";
import { processImage, safeObjectKey } from "@/server/storage/images";

export async function listPublishedItems(db: DbLike) {
  return db
    .select({ item: portfolioItems, category: portfolioCategories })
    .from(portfolioItems)
    .leftJoin(portfolioCategories, eq(portfolioCategories.id, portfolioItems.categoryId))
    .where(eq(portfolioItems.published, true))
    .orderBy(desc(portfolioItems.featured), asc(portfolioItems.sortOrder), desc(portfolioItems.createdAt));
}

export async function listAllItems(db: DbLike) {
  return db
    .select({ item: portfolioItems, category: portfolioCategories })
    .from(portfolioItems)
    .leftJoin(portfolioCategories, eq(portfolioCategories.id, portfolioItems.categoryId))
    .orderBy(asc(portfolioItems.sortOrder), desc(portfolioItems.createdAt));
}

export async function listCategories(db: DbLike) {
  return db.select().from(portfolioCategories).orderBy(asc(portfolioCategories.sortOrder), asc(portfolioCategories.name));
}

export async function getItem(db: DbLike, id: string) {
  const [row] = await db.select().from(portfolioItems).where(eq(portfolioItems.id, id));
  return row ?? null;
}

async function uniqueSlug(db: DbLike, title: string, excludeId?: string) {
  const base = slugify(title) || "trabalho";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [hit] = await db.select({ id: portfolioItems.id }).from(portfolioItems).where(eq(portfolioItems.slug, candidate));
    if (!hit || hit.id === excludeId) return candidate;
  }
  return `${base}-${generateToken(4).toLowerCase()}`;
}

export type ItemFields = {
  title: string;
  description: string;
  altText: string;
  categoryId: string | null;
  featured: boolean;
  published: boolean;
  isDemo: boolean;
};

export async function createItem(db: DbLike, params: { fields: ItemFields; file: File; actor: Actor }) {
  const img = await processImage(params.file);
  const stored = await putObject(safeObjectKey("portfolio"), img.buffer, img.contentType, "public");
  try {
    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${portfolioItems.sortOrder}), 0)::int` })
      .from(portfolioItems);
    const [item] = await db
      .insert(portfolioItems)
      .values({
        ...params.fields,
        slug: await uniqueSlug(db, params.fields.title),
        imageKey: stored.key,
        imageUrl: stored.url,
        width: img.width,
        height: img.height,
        blurDataUrl: img.blurDataUrl,
        sortOrder: maxOrder + 10,
        publishedAt: params.fields.published ? new Date() : null,
      })
      .returning();
    await audit(db, params.actor, "portfolio.created", { type: "portfolio", id: item.id }, { published: item.published });
    return item;
  } catch (e) {
    await deleteObject(stored.key, "public").catch(() => {});
    throw e;
  }
}

export async function updateItem(
  db: DbLike,
  params: { id: string; fields: ItemFields; file?: File | null; actor: Actor },
) {
  const current = await getItem(db, params.id);
  if (!current) throw new AppError("NOT_FOUND", "Trabalho não encontrado.", 404);
  let image: Partial<typeof portfolioItems.$inferInsert> = {};
  if (params.file && params.file.size > 0) {
    const img = await processImage(params.file);
    const stored = await putObject(safeObjectKey("portfolio"), img.buffer, img.contentType, "public");
    image = { imageKey: stored.key, imageUrl: stored.url, width: img.width, height: img.height, blurDataUrl: img.blurDataUrl };
  }
  const [item] = await db
    .update(portfolioItems)
    .set({
      ...params.fields,
      ...image,
      slug: current.title === params.fields.title ? current.slug : await uniqueSlug(db, params.fields.title, current.id),
      publishedAt: params.fields.published ? (current.publishedAt ?? new Date()) : null,
    })
    .where(eq(portfolioItems.id, current.id))
    .returning();
  if (image.imageKey) {
    // arquivo antigo fica órfão após a troca: remover com segurança
    await deleteObject(current.imageKey, "public").catch(() => {});
  }
  await audit(db, params.actor, "portfolio.updated", { type: "portfolio", id: item.id }, {
    published: item.published,
    featured: item.featured,
    imageReplaced: Boolean(image.imageKey),
  });
  return { before: current, after: item };
}

export async function deleteItem(db: DbLike, id: string, actor: Actor) {
  const [item] = await db.delete(portfolioItems).where(eq(portfolioItems.id, id)).returning();
  if (!item) return null;
  await deleteObject(item.imageKey, "public").catch((e) =>
    console.error("[portfolio] falha ao excluir arquivo:", e instanceof Error ? e.message : e),
  );
  await audit(db, actor, "portfolio.deleted", { type: "portfolio", id });
  return item;
}

/** Move o item uma posição para cima/baixo, trocando a ordem com o vizinho. */
export async function moveItem(db: DbLike, id: string, direction: "up" | "down") {
  const all = await db
    .select({ id: portfolioItems.id, sortOrder: portfolioItems.sortOrder })
    .from(portfolioItems)
    .orderBy(asc(portfolioItems.sortOrder), desc(portfolioItems.createdAt));
  const idx = all.findIndex((r) => r.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= all.length) return;
  // renormaliza para evitar empates
  const ordered = all.map((r) => r.id);
  [ordered[idx], ordered[swapIdx]] = [ordered[swapIdx], ordered[idx]];
  await db.transaction(async (tx) => {
    for (let i = 0; i < ordered.length; i++) {
      await tx.update(portfolioItems).set({ sortOrder: (i + 1) * 10 }).where(eq(portfolioItems.id, ordered[i]));
    }
  });
}

export async function saveCategory(db: DbLike, params: { id?: string; name: string; description: string; sortOrder: number }) {
  const slug = slugify(params.name);
  if (!slug) throw new AppError("INVALID", "Nome de categoria inválido.");
  try {
    if (params.id) {
      await db
        .update(portfolioCategories)
        .set({ name: params.name, slug, description: params.description, sortOrder: params.sortOrder })
        .where(eq(portfolioCategories.id, params.id));
    } else {
      await db.insert(portfolioCategories).values({ name: params.name, slug, description: params.description, sortOrder: params.sortOrder });
    }
  } catch (e) {
    if (pgErrorCode(e) === PG_UNIQUE_VIOLATION) throw new AppError("DUPLICATE", "Já existe uma categoria com esse nome.");
    throw e;
  }
}

export async function deleteCategory(db: DbLike, id: string) {
  await db.delete(portfolioCategories).where(and(eq(portfolioCategories.id, id)));
}
