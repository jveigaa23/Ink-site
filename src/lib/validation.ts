import { z } from "zod";
import { isValidLocalDate } from "./time";

/**
 * Esquemas de validação compartilhados entre navegador e servidor.
 * O servidor SEMPRE revalida; a validação no navegador serve apenas para feedback rápido.
 */

const trimmed = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);

export const normalizePhone = (v: string) => v.replace(/\D/g, "");

export const contactSchema = z
  .object({
    name: trimmed(80).min(2, "Informe seu nome."),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email("E-mail inválido.").max(200)]),
    phone: z
      .string()
      .trim()
      .transform(normalizePhone)
      .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), "Telefone inválido. Inclua o DDD."),
    privacyConsent: z.literal(true, { error: "É necessário concordar com o aviso de privacidade." }),
  })
  .refine((v) => v.email !== "" || v.phone !== "", {
    message: "Informe um e-mail ou telefone/WhatsApp para contato.",
    path: ["email"],
  });
export type ContactInput = z.infer<typeof contactSchema>;

export const SIZE_OPTIONS = [
  { value: "ate-5cm", label: "Pequena (até 5 cm)" },
  { value: "5-10cm", label: "Média (5 a 10 cm)" },
  { value: "10-20cm", label: "Grande (10 a 20 cm)" },
  { value: "20cm+", label: "Extra grande (mais de 20 cm)" },
  { value: "fechamento", label: "Fechamento / projeto extenso" },
  { value: "nao-sei", label: "Ainda não sei" },
] as const;

export const quoteRequestSchema = z.object({
  contact: contactSchema,
  style: trimmed(80).min(2, "Informe o estilo desejado."),
  bodyPart: trimmed(80).min(2, "Informe a parte do corpo."),
  size: z.enum(SIZE_OPTIONS.map((o) => o.value) as [string, ...string[]], { error: "Selecione o tamanho." }),
  description: trimmed(3000).min(20, "Descreva sua ideia com pelo menos 20 caracteres."),
  preferredDates: trimmed(300).optional().default(""),
  extraInfo: trimmed(1500).optional().default(""),
});
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

export const localDateSchema = z.string().refine(isValidLocalDate, "Data inválida.");

export const holdRequestSchema = z.object({
  serviceId: z.string().uuid("Serviço inválido."),
  startsAt: z.string().datetime({ offset: true, message: "Horário inválido." }),
});

export const bookingDetailsSchema = z.object({
  holdToken: z.string().min(20).max(100),
  contact: contactSchema,
  notes: trimmed(1500).optional().default(""),
});
export type BookingDetailsInput = z.infer<typeof bookingDetailsSchema>;

export const lookupSchema = z.object({
  protocol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(AG|OR)-[0-9A-Z]{4}-[0-9A-Z]{4}$/, "Protocolo inválido. Ex.: AG-7K2M-Q9XD."),
  contact: trimmed(200).min(5, "Informe o e-mail ou telefone usado na solicitação."),
});

export const cancelByClientSchema = z.object({
  reason: trimmed(500).optional().default(""),
});

/** Converte os erros do Zod em um mapa campo → mensagem (primeira mensagem de cada campo). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
