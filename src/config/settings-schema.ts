import { z } from "zod";

/**
 * Configurações editáveis pelo painel (persistidas na tabela `settings`).
 * Este arquivo é o ÚNICO lugar com valores-padrão de marca, contato e regras.
 * Nenhum dado real do estúdio é inventado: campos de contato começam vazios e
 * só aparecem no site depois de preenchidos no painel.
 */

const text = (max: number) => z.string().trim().max(max);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s<>"]+$/i.test(v), "Use um endereço https:// válido.");
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal, ex.: #b8442e.");

export const mediaRefSchema = z.object({
  key: z.string().max(300),
  url: z.string().url().max(1000),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: text(200).default(""),
  blurDataUrl: z.string().max(4000).optional(),
});
export type MediaRef = z.infer<typeof mediaRefSchema>;

export const studioSettingsSchema = z.object({
  name: text(80).min(1),
  /** Indica que o nome ainda é provisório (exibido somente no painel). */
  namePending: z.boolean(),
  tagline: text(140),
  heroTitle: text(120),
  heroSubtitle: text(280),
  artistName: text(80),
  artistBio: text(4000),
  studioStory: text(4000),
  specialties: z.array(text(60).min(1)).max(20),
  attendanceInfo: text(2000),
  aftercare: text(6000),
  depositPolicy: text(2000),
  cancellationPolicyText: text(2000),
  seoDescription: text(170),
  accentColor: hexColor,
  contact: z.object({
    whatsapp: z
      .string()
      .trim()
      .regex(/^(\+?\d{10,15})?$/, "Informe apenas números com DDI e DDD, ex.: 5511999999999."),
    phoneDisplay: text(40),
    email: z.union([z.literal(""), z.string().trim().email().max(200)]),
    instagram: z
      .string()
      .trim()
      .regex(/^([A-Za-z0-9._]{1,30})?$/, "Informe somente o usuário, sem @."),
    otherLinks: z.array(z.object({ label: text(40).min(1), url: optionalUrl })).max(6),
  }),
  address: z.object({
    line1: text(160),
    line2: text(160),
    city: text(80),
    state: text(40),
    postalCode: text(12),
    mapsUrl: optionalUrl,
    showOnSite: z.boolean(),
  }),
  hoursNote: text(300),
  privacyContactEmail: z.union([z.literal(""), z.string().trim().email().max(200)]),
  logo: mediaRefSchema.nullable(),
  heroImage: mediaRefSchema.nullable(),
  artistPhoto: mediaRefSchema.nullable(),
  studioPhotos: z.array(mediaRefSchema).max(12),
});
export type StudioSettings = z.infer<typeof studioSettingsSchema>;

export const bookingSettingsSchema = z.object({
  onlineBookingEnabled: z.boolean(),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Fuso horário inválido."),
  slotStepMinutes: z.number().int().min(15).max(240),
  bufferMinutes: z.number().int().min(0).max(240),
  minNoticeHours: z.number().int().min(0).max(24 * 30),
  maxAdvanceDays: z.number().int().min(1).max(365),
  holdMinutes: z.number().int().min(3).max(30),
  autoConfirm: z.boolean(),
  allowClientCancel: z.boolean(),
  allowClientReschedule: z.boolean(),
  rescheduleRequiresApproval: z.boolean(),
  cancellationNoticeHours: z.number().int().min(0).max(24 * 30),
  depositRequired: z.boolean(),
});
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

export const notificationSettingsSchema = z.object({
  emailEnabled: z.boolean(),
  adminEmail: z.union([z.literal(""), z.string().trim().email().max(200)]),
  reminderHoursBefore: z.number().int().min(2).max(96),
  notifyAdminOnNewRequests: z.boolean(),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export const privacySettingsSchema = z.object({
  /** Meses para manter orçamentos recusados/arquivados antes da exclusão automática. */
  quoteRetentionMonths: z.number().int().min(1).max(120),
  /** Meses de inatividade para anonimizar clientes sem agendamentos futuros. */
  clientRetentionMonths: z.number().int().min(6).max(240),
});
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;

export const DEFAULT_STUDIO: StudioSettings = {
  name: "Nome do Estúdio",
  namePending: true,
  tagline: "Estúdio de tatuagem",
  heroTitle: "Tatuagem como obra autoral.",
  heroSubtitle:
    "Cada projeto começa em uma conversa. Envie sua ideia, receba uma avaliação e reserve seu horário.",
  artistName: "",
  artistBio: "",
  studioStory: "",
  specialties: [],
  attendanceInfo: "",
  aftercare: "",
  depositPolicy: "",
  cancellationPolicyText: "",
  seoDescription: "Estúdio de tatuagem. Portfólio, orçamento e agendamento online.",
  accentColor: "#b8442e",
  contact: { whatsapp: "", phoneDisplay: "", email: "", instagram: "", otherLinks: [] },
  address: { line1: "", line2: "", city: "", state: "", postalCode: "", mapsUrl: "", showOnSite: false },
  hoursNote: "",
  privacyContactEmail: "",
  logo: null,
  heroImage: null,
  artistPhoto: null,
  studioPhotos: [],
};

export const DEFAULT_BOOKING: BookingSettings = {
  onlineBookingEnabled: true,
  timezone: "America/Sao_Paulo",
  slotStepMinutes: 30,
  bufferMinutes: 30,
  minNoticeHours: 24,
  maxAdvanceDays: 90,
  holdMinutes: 10,
  autoConfirm: false,
  allowClientCancel: true,
  allowClientReschedule: true,
  rescheduleRequiresApproval: true,
  cancellationNoticeHours: 48,
  depositRequired: false,
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  emailEnabled: true,
  adminEmail: "",
  reminderHoursBefore: 24,
  notifyAdminOnNewRequests: true,
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  quoteRetentionMonths: 12,
  clientRetentionMonths: 36,
};

export const SETTINGS = {
  studio: { schema: studioSettingsSchema, defaults: DEFAULT_STUDIO },
  booking: { schema: bookingSettingsSchema, defaults: DEFAULT_BOOKING },
  notifications: { schema: notificationSettingsSchema, defaults: DEFAULT_NOTIFICATIONS },
  privacy: { schema: privacySettingsSchema, defaults: DEFAULT_PRIVACY },
} as const;

export type SettingsKey = keyof typeof SETTINGS;
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;
