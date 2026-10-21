import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminSessions, notifications, portfolioItems, quoteReferences, quoteRequests } from "@/db/schema";
import { getAppointmentChainByToken } from "@/server/booking/service";
import { createAdminUser, login, validateSession } from "@/server/auth/core";
import { anonymizeClient } from "@/server/clients";
import { notifyQuote } from "@/server/notifications/events";
import { createItem, deleteItem, listPublishedItems, updateItem } from "@/server/portfolio/service";
import { adminUpdateQuote, convertQuoteToAppointment, createQuote, getQuoteByToken } from "@/server/quotes/service";
import { getPrivateObject } from "@/server/storage";
import { saveSettings } from "@/server/settings";
import { DEFAULT_NOTIFICATIONS } from "@/config/settings-schema";
import { db, hasDb, resetDb, seedStudio } from "../support/db";
import { makeImageFile } from "../support/image";

const admin = { type: "admin" as const, id: "00000000-0000-0000-0000-000000000001" };
const quoteInput = {
  contact: { name: "Ana Souza", email: "ana@example.com", phone: "", privacyConsent: true as const },
  style: "Blackwork",
  bodyPart: "Antebraço",
  size: "10-20cm",
  description: "Composição botânica com folhas e galhos em blackwork.",
  preferredDates: "",
  extraInfo: "",
};

describe.skipIf(!hasDb)("orçamentos (integração)", () => {
  beforeEach(resetDb);

  it("persiste o pedido com referências privadas sem metadados", async () => {
    const file = await makeImageFile("foto.jpg", 3000, 2000, true);
    const { quote, accessToken } = await createQuote(db, { input: quoteInput, files: [file] });
    expect(quote.status).toBe("received");
    const refs = await db.select().from(quoteReferences).where(eq(quoteReferences.quoteId, quote.id));
    expect(refs).toHaveLength(1);
    expect(Math.max(refs[0].width, refs[0].height)).toBe(1600); // redimensionada
    expect(refs[0].storageKey).not.toContain("foto"); // nome do arquivo não é reutilizado
    const stored = await getPrivateObject(refs[0].storageKey);
    const meta = await sharp(stored!.body as Buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    const view = await getQuoteByToken(db, accessToken);
    expect(view?.quote.protocol).toBe(quote.protocol);
    expect(await getQuoteByToken(db, "y".repeat(43))).toBeNull();
  });

  it("recusa arquivos que não são imagens e excesso de arquivos", async () => {
    const fake = new File([new TextEncoder().encode("<script>alert(1)</script>")], "x.jpg", { type: "image/jpeg" });
    await expect(createQuote(db, { input: quoteInput, files: [fake] })).rejects.toMatchObject({ code: "INVALID_FILE" });
    const many = await Promise.all([1, 2, 3, 4].map(() => makeImageFile()));
    await expect(createQuote(db, { input: quoteInput, files: many })).rejects.toMatchObject({ code: "TOO_MANY_FILES" });
    expect(await db.select().from(quoteRequests)).toHaveLength(0);
  });

  it("aplica transições de status, estimativa e histórico", async () => {
    const { quote } = await createQuote(db, { input: quoteInput, files: [] });
    const base = { id: quote.id, estimateMinCents: 50000, estimateMaxCents: 80000, messageToClient: "Podemos fazer em 1 sessão.", internalNotes: "", proposedSlots: [], actor: admin };
    const r = await adminUpdateQuote(db, { ...base, status: "in_review" });
    expect(r.clientVisibleChange).toBe(true);
    await expect(adminUpdateQuote(db, { ...base, status: "received" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(adminUpdateQuote(db, { ...base, status: "in_review", estimateMinCents: 9, estimateMaxCents: 1 })).rejects.toMatchObject({ code: "INVALID" });
  });

  it("converte orçamento em agendamento uma única vez", async () => {
    const svc = await seedStudio();
    const { quote, accessToken } = await createQuote(db, { input: quoteInput, files: [] });
    const startsAt = new Date("2026-12-02T10:00:00-03:00");
    const conv = await convertQuoteToAppointment(db, { quoteId: quote.id, serviceId: svc.id, startsAt, durationMinutes: 240, status: "confirmed", overrideRules: false, actor: admin });
    expect(conv.appointment.quoteId).toBe(quote.id);
    const view = await getQuoteByToken(db, accessToken);
    expect(view?.quote.status).toBe("approved");
    expect(view?.appointment?.appt.status).toBe("confirmed");
    await expect(
      convertQuoteToAppointment(db, { quoteId: quote.id, serviceId: svc.id, startsAt: new Date("2026-12-03T10:00:00-03:00"), durationMinutes: 60, status: "confirmed", overrideRules: false, actor: admin }),
    ).rejects.toMatchObject({ code: "ALREADY_CONVERTED" });
    expect(await getAppointmentChainByToken(db, conv.accessToken)).not.toBeNull();
  });

  it("falha do provedor de e-mail é registrada sem desfazer a solicitação", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "estudio@example.com";
    await saveSettings(db, "notifications", { ...DEFAULT_NOTIFICATIONS, adminEmail: "" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("indisponível", { status: 503 }));
    try {
      const { quote, accessToken } = await createQuote(db, { input: quoteInput, files: [] });
      await notifyQuote(db, quote, "received", { accessToken });
      const [n] = await db.select().from(notifications);
      expect(n.status).toBe("failed");
      expect(n.error).toContain("503");
      expect(n.body).not.toContain(accessToken); // o link secreto não é persistido
      const sentBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(sentBody.text).toContain(accessToken); // mas é incluído no envio
      expect(await db.select().from(quoteRequests)).toHaveLength(1);
    } finally {
      fetchMock.mockRestore();
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_FROM;
    }
  });

  it("anonimiza o cliente a pedido do titular e remove referências", async () => {
    const { quote } = await createQuote(db, { input: quoteInput, files: [await makeImageFile()] });
    await anonymizeClient(db, quote.clientId!, admin);
    const [q] = await db.select().from(quoteRequests);
    expect(q.description).toMatch(/removido/);
    expect(await db.select().from(quoteReferences)).toHaveLength(0);
  });
});

describe.skipIf(!hasDb)("autenticação (integração)", () => {
  beforeEach(resetDb);
  afterEach(() => vi.useRealTimers());

  it("não permite senhas fracas", async () => {
    await expect(createAdminUser(db, { email: "a@b.com", name: "A", password: "123456" })).rejects.toMatchObject({ code: "WEAK_PASSWORD" });
  });

  it("faz login, valida sessão por hash e rejeita credenciais inválidas", async () => {
    await createAdminUser(db, { email: "Dono@Estudio.com", name: "Dono", password: "Senha-Forte-2026" });
    await expect(login(db, { email: "dono@estudio.com", password: "errada", ip: "1.1.1.1" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(login(db, { email: "naoexiste@x.com", password: "x", ip: "1.1.1.1" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    const { token } = await login(db, { email: "DONO@estudio.com", password: "Senha-Forte-2026", ip: "1.1.1.1" });
    const [row] = await db.select().from(adminSessions);
    expect(row.id).not.toBe(token); // somente o hash é armazenado
    expect((await validateSession(db, token))?.email).toBe("dono@estudio.com");
    expect(await validateSession(db, token + "x")).toBeNull();
    expect(await validateSession(db, token, new Date(Date.now() + 8 * 86_400_000))).toBeNull();
  });

  it("bloqueia força bruta por e-mail", async () => {
    await createAdminUser(db, { email: "dono@estudio.com", name: "Dono", password: "Senha-Forte-2026" });
    for (let i = 0; i < 8; i++) {
      await login(db, { email: "dono@estudio.com", password: "errada", ip: `10.0.0.${i}` }).catch(() => {});
    }
    await expect(login(db, { email: "dono@estudio.com", password: "Senha-Forte-2026", ip: "10.0.0.99" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe.skipIf(!hasDb)("portfólio (integração)", () => {
  beforeEach(resetDb);
  const fields = { title: "Ramo de oliveira", description: "", altText: "Tatuagem fineline de ramo de oliveira no antebraço", categoryId: null, featured: false, published: false, isDemo: false };

  it("publica somente itens marcados como publicados, substitui e exclui arquivos", async () => {
    const item = await createItem(db, { fields, file: await makeImageFile("a.jpg", 1200, 1600), actor: admin });
    expect(item.slug).toBe("ramo-de-oliveira");
    expect(await listPublishedItems(db)).toHaveLength(0);
    const { after } = await updateItem(db, { id: item.id, fields: { ...fields, published: true }, file: await makeImageFile("b.jpg"), actor: admin });
    expect(after.imageKey).not.toBe(item.imageKey);
    expect(after.publishedAt).not.toBeNull();
    expect(await listPublishedItems(db)).toHaveLength(1);
    const second = await createItem(db, { fields, file: await makeImageFile(), actor: admin });
    expect(second.slug).toBe("ramo-de-oliveira-2");
    await deleteItem(db, item.id, admin);
    expect(await db.select().from(portfolioItems)).toHaveLength(1);
  });
});
