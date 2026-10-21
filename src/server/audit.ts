import { auditLog } from "@/db/schema";
import type { DbLike } from "@/db/types";

export type Actor = { type: "admin"; id: string } | { type: "client" } | { type: "system" };

export const SYSTEM: Actor = { type: "system" };
export const CLIENT: Actor = { type: "client" };

/** Registra uma alteração relevante. Não inclua dados pessoais desnecessários em `data`. */
export async function audit(
  db: DbLike,
  actor: Actor,
  action: string,
  entity: { type: string; id: string },
  data?: Record<string, unknown>,
) {
  await db.insert(auditLog).values({
    actorType: actor.type,
    actorId: actor.type === "admin" ? actor.id : null,
    action,
    entityType: entity.type,
    entityId: entity.id,
    data: data ?? null,
  });
}
