import { expect, test } from "@playwright/test";
import { fillContact, waitHuman } from "./helpers";

test("navegação pública principal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Portfólio" }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(page.getByText("Nenhum trabalho publicado ainda.")).toBeVisible();
  for (const path of ["/estudio", "/servicos", "/cuidados", "/contato", "/privacidade"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  const res = await page.goto("/pagina-que-nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Página")).toBeVisible();
});

test("SEO: sitemap, robots e metadados", async ({ page, request }) => {
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  await page.goto("/servicos");
  await expect(page).toHaveTitle(/Serviços/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/servicos$/);
});

test("formulário de orçamento valida e persiste", async ({ page }) => {
  await page.goto("/orcamento");
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.getByText("Informe o estilo desejado.")).toBeVisible();
  await expect(page.getByLabel("Estilo desejado")).toBeFocused();

  await page.getByLabel("Estilo desejado").fill("Fineline");
  await page.getByLabel("Parte do corpo").fill("Antebraço");
  await page.getByLabel("Tamanho aproximado").selectOption("5-10cm");
  await page.getByLabel("Descreva sua ideia").fill("Um ramo de oliveira com traço fino e delicado.");
  await page.getByLabel("Referências visuais (opcional)").setInputFiles({
    name: "ref.png",
    mimeType: "image/png",
    // PNG 1x1 válido
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
  });
  await fillContact(page);
  await waitHuman(page);
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page).toHaveURL(/\/acompanhar\/orcamento\/[\w-]+\?novo=1/);
  await expect(page.getByText("Pedido enviado")).toBeVisible();
  await expect(page.getByText("Recebida")).toBeVisible();
  await expect(page.getByText("1 imagem(ns)")).toBeVisible();
});

test("agendamento: consulta horários reais, reserva e confirma como solicitação pendente", async ({ page }) => {
  await page.goto("/agendar");
  // um único serviço já vem selecionado
  const dates = page.getByRole("group", { name: "Escolha uma data" }).getByRole("button");
  await dates.nth(1).click();
  const slots = page.locator("ul button[aria-pressed]");
  await expect(slots.first()).toBeVisible();
  const label = (await slots.first().textContent())!.trim();
  await slots.first().click();
  await expect(page.getByText(/Horário reservado temporariamente/)).toBeVisible();
  await fillContact(page, "Bianca Agenda");
  await page.getByLabel("Observações (opcional)").fill("Teste automatizado");
  await waitHuman(page);
  await page.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(page).toHaveURL(/\/acompanhar\/[\w-]+\?novo=1/);
  await expect(page.getByText("Solicitação recebida — aguardando confirmação")).toBeVisible();
  await expect(page.getByText(new RegExp(`^${label} – .*Sessão de teste$`))).toBeVisible();

  // o horário reservado não é mais oferecido
  await page.goto("/agendar");
  await page.getByRole("group", { name: "Escolha uma data" }).getByRole("button").nth(1).click();
  await expect(page.locator("ul button[aria-pressed]").first()).toBeVisible();
  await expect(page.locator("ul button[aria-pressed]", { hasText: new RegExp(`^${label}$`) })).toHaveCount(0);
});

test("link de acompanhamento inválido não revela dados", async ({ page }) => {
  // a página é transmitida por streaming; o conteúdo exibido é o de "não encontrada"
  await page.goto("/acompanhar/" + "a".repeat(43));
  await expect(page.getByRole("heading", { name: /não encontrada/ })).toBeVisible();
  await expect(page.getByText(/Protocolo/)).toHaveCount(0);
  await page.goto("/acompanhar/orcamento/" + "b".repeat(43));
  await expect(page.getByRole("heading", { name: /não encontrada/ })).toBeVisible();
});
