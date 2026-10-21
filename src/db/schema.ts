import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const appointmentStatus = pgEnum("appointment_status", [
  "held", // horário temporariamente reservado enquanto o cliente preenche os dados
  "pending", // solicitação recebida, aguardando confirmação do estúdio
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
  "expired", // reserva temporária que expirou sem confirmação
]);

export const quoteStatus = pgEnum("quote_status", [
  "received",
  "in_review",
  "awaiting_client",
  "approved",
  "declined",
  "archived",
]);

export const priceType = pgEnum("price_type", ["on_request", "from", "fixed"]);

export const notificationStatus = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
  "manual_pending", // sem provedor configurado: aguardando envio manual pelo painel
  "manual_done",
  "dismissed",
]);

export const notificationChannel = pgEnum("notification_channel", ["email", "whatsapp_manual"]);

export const adminRole = pgEnum("admin_role", ["owner", "staff"]);

/* ------------------------------------------------------------------ */
/* Administração e segurança                                          */
/* ------------------------------------------------------------------ */

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: adminRole("role").notNull().default("owner"),
    active: boolean("active").notNull().default(true),
    lastLoginAt: ts("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("admin_users_email_uq").on(sql`lower(${t.email})`)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    /** SHA-256 do token do cookie. O token em si nunca é armazenado. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("admin_sessions_user_idx").on(t.userId), index("admin_sessions_exp_idx").on(t.expiresAt)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull().default(0),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorType: text("actor_type").notNull(), // admin | client | system
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Configurações                                                      */
/* ------------------------------------------------------------------ */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------------ */
/* Clientes                                                           */
/* ------------------------------------------------------------------ */

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    internalNotes: text("internal_notes"),
    privacyConsentAt: ts("privacy_consent_at"),
    anonymizedAt: ts("anonymized_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("clients_email_idx").on(sql`lower(${t.email})`),
    index("clients_phone_idx").on(t.phone),
    index("clients_created_idx").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Serviços e disponibilidade                                         */
/* ------------------------------------------------------------------ */

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    durationMinutes: integer("duration_minutes").notNull(),
    priceType: priceType("price_type").notNull().default("on_request"),
    priceCents: integer("price_cents"),
    bookableOnline: boolean("bookable_online").notNull().default(true),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("services_duration_chk", sql`${t.durationMinutes} between 15 and 720`),
    check("services_price_chk", sql`${t.priceCents} is null or ${t.priceCents} >= 0`),
  ],
);

/** Expediente semanal. Vários intervalos por dia são permitidos (ex.: pausa para almoço). */
export const businessHours = pgTable(
  "business_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weekday: smallint("weekday").notNull(), // 0 = domingo … 6 = sábado
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [
    check("bh_weekday_chk", sql`${t.weekday} between 0 and 6`),
    check("bh_range_chk", sql`${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.startMinute} < ${t.endMinute}`),
    index("bh_weekday_idx").on(t.weekday),
  ],
);

/** Bloqueios de agenda: folgas, férias, compromissos. */
export const availabilityBlocks = pgTable(
  "availability_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    check("blocks_range_chk", sql`${t.endsAt} > ${t.startsAt}`),
    index("blocks_range_idx").on(t.startsAt, t.endsAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Orçamentos                                                          */
/* ------------------------------------------------------------------ */

export type ProposedSlot = { startsAt: string; note?: string };

export const quoteRequests = pgTable(
  "quote_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    protocol: text("protocol").notNull().unique(),
    accessTokenHash: text("access_token_hash").notNull().unique(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    status: quoteStatus("status").notNull().default("received"),
    style: text("style").notNull(),
    bodyPart: text("body_part").notNull(),
    size: text("size").notNull(),
    description: text("description").notNull(),
    preferredDates: text("preferred_dates"),
    extraInfo: text("extra_info"),
    estimateMinCents: integer("estimate_min_cents"),
    estimateMaxCents: integer("estimate_max_cents"),
    /** Mensagem do estúdio visível ao cliente na página de acompanhamento. */
    messageToClient: text("message_to_client"),
    internalNotes: text("internal_notes"),
    proposedSlots: jsonb("proposed_slots").$type<ProposedSlot[]>().notNull().default([]),
    appointmentId: uuid("appointment_id").references((): AnyPgColumn => appointments.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("quotes_status_idx").on(t.status, t.createdAt),
    index("quotes_client_idx").on(t.clientId),
    check(
      "quotes_estimate_chk",
      sql`${t.estimateMinCents} is null or ${t.estimateMaxCents} is null or ${t.estimateMinCents} <= ${t.estimateMaxCents}`,
    ),
  ],
);

export const quoteReferences = pgTable(
  "quote_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("quote_refs_quote_idx").on(t.quoteId)],
);

/* ------------------------------------------------------------------ */
/* Agendamentos                                                        */
/* ------------------------------------------------------------------ */

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    protocol: text("protocol").notNull().unique(),
    /**
     * Hash do token secreto do link de acompanhamento. Apenas o agendamento raiz de
     * uma cadeia de reagendamentos possui token; os demais apontam para a raiz.
     */
    accessTokenHash: text("access_token_hash").unique(),
    rootId: uuid("root_id").references((): AnyPgColumn => appointments.id, { onDelete: "set null" }),
    rescheduledFromId: uuid("rescheduled_from_id").references((): AnyPgColumn => appointments.id, {
      onDelete: "set null",
    }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id").references((): AnyPgColumn => quoteRequests.id, { onDelete: "set null" }),
    status: appointmentStatus("status").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    /** Fim do intervalo ocupado (término + intervalo entre sessões). Usado na restrição de exclusão. */
    blockedUntil: ts("blocked_until").notNull(),
    holdExpiresAt: ts("hold_expires_at"),
    /** Hash do IP de quem criou a reserva temporária (antiabuso). */
    holdIpHash: text("hold_ip_hash"),
    source: text("source").notNull().default("online"), // online | admin | quote
    clientNotes: text("client_notes"),
    internalNotes: text("internal_notes"),
    cancelReason: text("cancel_reason"),
    cancelledBy: text("cancelled_by"),
    depositReceivedAt: ts("deposit_received_at"),
    confirmedAt: ts("confirmed_at"),
    cancelledAt: ts("cancelled_at"),
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("appt_range_chk", sql`${t.endsAt} > ${t.startsAt} and ${t.blockedUntil} >= ${t.endsAt}`),
    index("appt_starts_idx").on(t.startsAt),
    index("appt_status_starts_idx").on(t.status, t.startsAt),
    index("appt_client_idx").on(t.clientId),
    index("appt_root_idx").on(t.rootId),
    // A restrição de exclusão (sem sobreposição) é criada na migração SQL personalizada.
  ],
);

/* ------------------------------------------------------------------ */
/* Portfólio                                                           */
/* ------------------------------------------------------------------ */

export const portfolioCategories = pgTable("portfolio_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    altText: text("alt_text").notNull(),
    categoryId: uuid("category_id").references(() => portfolioCategories.id, { onDelete: "set null" }),
    imageKey: text("image_key").notNull(),
    imageUrl: text("image_url").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    blurDataUrl: text("blur_data_url"),
    featured: boolean("featured").notNull().default(false),
    published: boolean("published").notNull().default(false),
    /** Imagem demonstrativa — não é trabalho real do estúdio. Exibida com aviso. */
    isDemo: boolean("is_demo").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("portfolio_pub_idx").on(t.published, t.sortOrder),
    index("portfolio_cat_idx").on(t.categoryId),
  ],
);

/* ------------------------------------------------------------------ */
/* Notificações                                                        */
/* ------------------------------------------------------------------ */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: notificationChannel("channel").notNull(),
    template: text("template").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: notificationStatus("status").notNull(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    providerMessageId: text("provider_message_id"),
    relatedType: text("related_type").notNull(),
    relatedId: uuid("related_id").notNull(),
    /** Chave de idempotência: evita lembretes ou confirmações duplicadas. */
    dedupeKey: text("dedupe_key").notNull().unique(),
    sentAt: ts("sent_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("notif_status_idx").on(t.status, t.createdAt),
    index("notif_related_idx").on(t.relatedType, t.relatedId),
  ],
);

export type Appointment = typeof appointments.$inferSelect;
export type AppointmentStatus = (typeof appointmentStatus.enumValues)[number];
export type QuoteStatus = (typeof quoteStatus.enumValues)[number];
export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type PortfolioItem = typeof portfolioItems.$inferSelect;
export type PortfolioCategory = typeof portfolioCategories.$inferSelect;
export type BusinessHour = typeof businessHours.$inferSelect;
export type AvailabilityBlock = typeof availabilityBlocks.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
