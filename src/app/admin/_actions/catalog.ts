"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { parseMoneyToCents } from "@/lib/money";
import { AppError } from "@/lib/errors";
import { isNextControlFlow, toErrorState, type ActionState } from "@/server/action-result";
import { requireAdmin } from "@/server/auth/session";
import { TAGS } from "@/server/cache-tags";
import { deleteService, saveService } from "@/server/catalog";
import { anonymizeClient, updateClientNotes } from "@/server/clients";

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  description: z.string().trim().max(1000),
  durationMinutes: z.coerce.number().int().min(15, "Mínimo de 15 minutos.").max(720, "Máximo de 12 horas."),
  priceType: z.enum(["on_request", "from", "fixed"]),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export async function saveServiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const input = serviceSchema.parse({
      id: fd.get("id") || undefined,
      name: fd.get("name"),
      description: fd.get("description") ?? "",
      durationMinutes: fd.get("durationMinutes"),
      priceType: fd.get("priceType"),
      sortOrder: fd.get("sortOrder") || 0,
    });
    const priceRaw = String(fd.get("price") ?? "").trim();
    const priceCents = priceRaw ? parseMoneyToCents(priceRaw) : null;
    if (priceRaw && priceCents == null) throw new AppError("INVALID", "Valor inválido.", 400, { price: "Use o formato 350,00." });
    await saveService(getDb(), {
      id: input.id,
      fields: {
        name: input.name,
        description: input.description,
        durationMinutes: input.durationMinutes,
        priceType: input.priceType,
        priceCents,
        bookableOnline: fd.get("bookableOnline") === "on",
        active: fd.get("active") === "on",
        sortOrder: input.sortOrder,
      },
      actor: { type: "admin", id: admin.id },
    });
    updateTag(TAGS.services);
    return { status: "success", message: "Serviço salvo." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}

export async function deleteServiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    await deleteService(getDb(), z.string().uuid().parse(fd.get("id")), { type: "admin", id: admin.id });
    updateTag(TAGS.services);
    return { status: "success", message: "Serviço excluído." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}

export async function clientNotesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    await updateClientNotes(
      getDb(),
      z.string().uuid().parse(fd.get("id")),
      z.string().trim().max(4000).parse(fd.get("internalNotes") ?? ""),
      { type: "admin", id: admin.id },
    );
    return { status: "success", message: "Observações salvas." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}

export async function anonymizeClientAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    if (fd.get("confirmText") !== "EXCLUIR") throw new AppError("INVALID", "Digite EXCLUIR para confirmar.", 400, { confirmText: "Digite EXCLUIR." });
    await anonymizeClient(getDb(), z.string().uuid().parse(fd.get("id")), { type: "admin", id: admin.id });
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
  redirect("/admin/clientes");
}
