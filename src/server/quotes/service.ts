import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import {
  appointments,
  clients,
  quoteReferences,
  quoteRequests,
  services,
  type ProposedSlot,
  type QuoteStatus,
} from "@/db/schema";
import type { DbLike } from "@/db/types";
import { canTransitionQuote } from "@/domain/status";
import { generateProtocol, generateToken, sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import type { QuoteRequestInput } from "@/lib/validation";
import { audit, CLIENT, type Actor } from "@/server/audit";
import { adminCreateAppointment } from "@/server/booking/service";
import { upsertClientFromContact } from "@/server/clients";
import { deleteObject, putObject } from "@/server/storage";
import { processImage, safeObjectKey } from "@/server/storage/images";

export const MAX_REFERENCES = 3;

/**
 * Cria a solicitação de orçamento. As referências são processadas e enviadas ao
 * armazenamento PRIVADO antes da transação; se a gravação falhar, os arquivos são removidos.
 */
export async function createQuote(
  db: DbLike,
  params: { input: QuoteRequestInput; files: File[]; now?: Date },
) {
  const now = params.now ?? new Date();
  const files = params.files.filter((f) => f.size > 0);
  if (files.length > MAX_REFERENCES) {
    throw new AppError("TOO_MANY_FILES", `Envie no máximo ${MAX_REFERENCES} imagens de referência.`);
  }

  const processed = [];
  for (const f of files) processed.push(await processImage(f, { maxDimension: 1600 }));

  const uploaded: { key: string; img: (typeof processed)[number] }[] = [];
  try {
    for (const img of processed) {
      const { key } = await putObject(safeObjectKey("references"), img.buffer, img.contentType, "private");
      uploaded.push({ key, img });
    }

    const token = generateToken();
    const quote = await db.transaction(async (tx) => {
      const client = await upsertClientFromContact(tx, params.input.contact, now);
      const [q] = await tx
        .insert(quoteRequests)
        .values({
          protocol: generateProtocol("OR"),
          accessTokenHash: sha256(token),
          clientId: client.id,
          style: params.input.style,
          bodyPart: params.input.bodyPart,
          size: params.input.size,
          description: params.input.description,
          preferredDates: params.input.preferredDates || null,
          extraInfo: params.input.extraInfo || null,
        })
        .returning();
      if (uploaded.length) {
        await tx.insert(quoteReferences).values(
          uploaded.map(({ key, img }) => ({
            quoteId: q.id,
            storageKey: key,
            contentType: img.contentType,
            sizeBytes: img.sizeBytes,
            width: img.width,
            height: img.height,
          })),
        );
      }
      await audit(tx, CLIENT, "quote.created", { type: "quote", id: q.id }, { references: uploaded.length });
      return q;
    });
    return { quote, accessToken: token };
  } catch (e) {
    await Promise.allSettled(uploaded.map((u) => deleteObject(u.key, "private")));
    throw e;
  }
}

export async function getQuoteByToken(db: DbLike, token: string) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.accessTokenHash, sha256(token)));
  if (!quote) return null;
  const appointment = quote.appointmentId
    ? ((
        await db
          .select({ appt: appointments, serviceName: services.name })
          .from(appointments)
          .innerJoin(services, eq(services.id, appointments.serviceId))
          .where(eq(appointments.id, quote.appointmentId))
      )[0] ?? null)
    : null;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(quoteReferences)
    .where(eq(quoteReferences.quoteId, quote.id));
  return { quote, appointment, referenceCount: n };
}

/* ------------------------------ Painel ------------------------------ */

export async function listQuotes(
  db: DbLike,
  params: { status?: QuoteStatus | "open"; q?: string; from?: Date; to?: Date; page: number; pageSize?: number },
) {
  const pageSize = params.pageSize ?? 20;
  const q = params.q?.trim();
  const conds = [
    params.status === "open"
      ? inArray(quoteRequests.status, ["received", "in_review", "awaiting_client"])
      : params.status
        ? eq(quoteRequests.status, params.status)
        : undefined,
    params.from ? gte(quoteRequests.createdAt, params.from) : undefined,
    params.to ? lt(quoteRequests.createdAt, params.to) : undefined,
    q
      ? or(
          ilike(quoteRequests.protocol, `%${q}%`),
          ilike(quoteRequests.style, `%${q}%`),
          ilike(quoteRequests.description, `%${q}%`),
          ilike(clients.name, `%${q}%`),
        )
      : undefined,
  ];
  const rows = await db
    .select({
      id: quoteRequests.id,
      protocol: quoteRequests.protocol,
      status: quoteRequests.status,
      style: quoteRequests.style,
      bodyPart: quoteRequests.bodyPart,
      size: quoteRequests.size,
      createdAt: quoteRequests.createdAt,
      clientName: clients.name,
      refs: sql<number>`(select count(*)::int from ${quoteReferences} r where r.quote_id = ${quoteRequests.id})`,
    })
    .from(quoteRequests)
    .leftJoin(clients, eq(clients.id, quoteRequests.clientId))
    .where(and(...conds))
    .orderBy(desc(quoteRequests.createdAt))
    .limit(pageSize + 1)
    .offset((params.page - 1) * pageSize);
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function getQuoteDetail(db: DbLike, id: string) {
  const [row] = await db
    .select({ quote: quoteRequests, client: clients })
    .from(quoteRequests)
    .leftJoin(clients, eq(clients.id, quoteRequests.clientId))
    .where(eq(quoteRequests.id, id));
  if (!row) return null;
  const refs = await db.select().from(quoteReferences).where(eq(quoteReferences.quoteId, id));
  return { ...row, refs };
}

export async function getReference(db: DbLike, refId: string) {
  const [ref] = await db.select().from(quoteReferences).where(eq(quoteReferences.id, refId));
  return ref ?? null;
}

export async function adminUpdateQuote(
  db: DbLike,
  params: {
    id: string;
    status: QuoteStatus;
    estimateMinCents: number | null;
    estimateMaxCents: number | null;
    messageToClient: string;
    internalNotes: string;
    proposedSlots: ProposedSlot[];
    actor: Actor;
  },
) {
  if (
    params.estimateMinCents != null &&
    params.estimateMaxCents != null &&
    params.estimateMinCents > params.estimateMaxCents
  ) {
    throw new AppError("INVALID", "A estimativa mínima não pode ser maior que a máxima.");
  }
  return db.transaction(async (tx) => {
    const [q] = await tx.select().from(quoteRequests).where(eq(quoteRequests.id, params.id)).for("update");
    if (!q) throw new AppError("NOT_FOUND", "Orçamento não encontrado.", 404);
    if (q.status !== params.status && !canTransitionQuote(q.status, params.status)) {
      throw new AppError("INVALID_TRANSITION", "Esta mudança de status não é permitida.", 409);
    }
    const [updated] = await tx
      .update(quoteRequests)
      .set({
        status: params.status,
        estimateMinCents: params.estimateMinCents,
        estimateMaxCents: params.estimateMaxCents,
        messageToClient: params.messageToClient || null,
        internalNotes: params.internalNotes || null,
        proposedSlots: params.proposedSlots,
      })
      .where(eq(quoteRequests.id, q.id))
      .returning();
    const changes: Record<string, unknown> = {};
    if (q.status !== updated.status) changes.status = { from: q.status, to: updated.status };
    if (q.estimateMinCents !== updated.estimateMinCents || q.estimateMaxCents !== updated.estimateMaxCents)
      changes.estimate = [updated.estimateMinCents, updated.estimateMaxCents];
    if (q.messageToClient !== updated.messageToClient) changes.messageToClient = true;
    if (JSON.stringify(q.proposedSlots) !== JSON.stringify(updated.proposedSlots))
      changes.proposedSlots = updated.proposedSlots.length;
    if (Object.keys(changes).length) {
      await audit(tx, params.actor, "quote.updated", { type: "quote", id: q.id }, changes);
    }
    return { before: q, after: updated, clientVisibleChange: Boolean(changes.status || changes.messageToClient || changes.proposedSlots || changes.estimate) };
  });
}

export async function convertQuoteToAppointment(
  db: DbLike,
  params: {
    quoteId: string;
    serviceId: string;
    startsAt: Date;
    durationMinutes: number;
    status: "pending" | "confirmed";
    overrideRules: boolean;
    actor: Actor;
  },
) {
  const [q] = await db.select().from(quoteRequests).where(eq(quoteRequests.id, params.quoteId));
  if (!q) throw new AppError("NOT_FOUND", "Orçamento não encontrado.", 404);
  if (!q.clientId) throw new AppError("INVALID", "O orçamento não possui cliente vinculado.");
  if (q.appointmentId) {
    const [existing] = await db
      .select({ status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, q.appointmentId));
    if (existing && ["pending", "confirmed"].includes(existing.status)) {
      throw new AppError("ALREADY_CONVERTED", "Este orçamento já possui um agendamento ativo.", 409);
    }
  }
  const result = await adminCreateAppointment(db, {
    serviceId: params.serviceId,
    clientId: q.clientId,
    startsAt: params.startsAt,
    durationMinutes: params.durationMinutes,
    status: params.status,
    overrideRules: params.overrideRules,
    quoteId: q.id,
    actor: params.actor,
  });
  await db
    .update(quoteRequests)
    .set({ appointmentId: result.appointment.id, status: "approved" })
    .where(eq(quoteRequests.id, q.id));
  await audit(db, params.actor, "quote.converted", { type: "quote", id: q.id }, {
    appointmentId: result.appointment.id,
  });
  return result;
}

/** Exclui orçamentos recusados/arquivados mais antigos que o prazo de retenção. */
export async function purgeOldQuotes(db: DbLike, olderThan: Date) {
  const old = await db
    .select({ id: quoteRequests.id })
    .from(quoteRequests)
    .where(and(inArray(quoteRequests.status, ["declined", "archived"]), lt(quoteRequests.updatedAt, olderThan)))
    .limit(200);
  if (!old.length) return 0;
  const ids = old.map((o) => o.id);
  const refs = await db
    .select({ key: quoteReferences.storageKey })
    .from(quoteReferences)
    .where(inArray(quoteReferences.quoteId, ids));
  await db.delete(quoteRequests).where(inArray(quoteRequests.id, ids));
  await Promise.allSettled(refs.map((r) => deleteObject(r.key, "private")));
  return ids.length;
}
