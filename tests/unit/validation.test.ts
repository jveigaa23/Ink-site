import { describe, expect, it } from "vitest";
import { contactSchema, fieldErrors, quoteRequestSchema } from "@/lib/validation";
import { generateProtocol, hashPassword, verifyPassword } from "@/lib/crypto";
import { parseMoneyToCents } from "@/lib/money";
import { studioSettingsSchema, DEFAULT_STUDIO } from "@/config/settings-schema";

const contact = { name: "Ana Souza", email: "ana@example.com", phone: "", privacyConsent: true };

describe("validação de formulários", () => {
  it("exige ao menos um meio de contato", () => {
    const r = contactSchema.safeParse({ ...contact, email: "", phone: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).email).toMatch(/e-mail ou telefone/);
  });

  it("normaliza telefone e exige consentimento", () => {
    const r = contactSchema.safeParse({ ...contact, email: "", phone: "(11) 98888-7777" });
    expect(r.success && r.data.phone).toBe("11988887777");
    expect(contactSchema.safeParse({ ...contact, privacyConsent: false }).success).toBe(false);
  });

  it("valida o pedido de orçamento", () => {
    const base = { contact, style: "Fineline", bodyPart: "Antebraço", size: "5-10cm", description: "Um ramo de oliveira delicado, traço fino." };
    expect(quoteRequestSchema.safeParse(base).success).toBe(true);
    const bad = quoteRequestSchema.safeParse({ ...base, description: "curta", size: "xx" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(Object.keys(fieldErrors(bad.error))).toEqual(expect.arrayContaining(["description", "size"]));
  });

  it("valida configurações (cor e links seguros)", () => {
    expect(studioSettingsSchema.safeParse(DEFAULT_STUDIO).success).toBe(true);
    expect(studioSettingsSchema.safeParse({ ...DEFAULT_STUDIO, accentColor: "red;}" }).success).toBe(false);
    const js = { ...DEFAULT_STUDIO, address: { ...DEFAULT_STUDIO.address, mapsUrl: "javascript:alert(1)" } };
    expect(studioSettingsSchema.safeParse(js).success).toBe(false);
  });
});

describe("utilitários", () => {
  it("gera protocolos no formato esperado e não sequenciais", () => {
    const a = generateProtocol("AG");
    expect(a).toMatch(/^AG-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(new Set(Array.from({ length: 200 }, () => generateProtocol("AG"))).size).toBe(200);
  });

  it("faz hash e verificação de senha", async () => {
    const h = await hashPassword("Correta-Senha-123");
    expect(await verifyPassword("Correta-Senha-123", h)).toBe(true);
    expect(await verifyPassword("errada", h)).toBe(false);
  });

  it("interpreta valores em reais", () => {
    expect(parseMoneyToCents("1.250,50")).toBe(125050);
    expect(parseMoneyToCents("300")).toBe(30000);
    expect(parseMoneyToCents("abc")).toBeNull();
  });
});
