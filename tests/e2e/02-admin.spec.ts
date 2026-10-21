import { expect, test } from "@playwright/test";
import { adminLogin, ADMIN } from "./helpers";

test("acesso não autorizado é bloqueado", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin/clientes");
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await request.get("/api/admin/references/00000000-0000-0000-0000-000000000000")).status()).toBe(401);
  expect((await request.get("/api/cron/daily")).status()).toBe(401);
});

test("login rejeita senha incorreta", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill("senha-errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});

test("administrador gerencia solicitações, orçamentos e portfólio", async ({ page }) => {
  await adminLogin(page);

  // agenda: confirmar a solicitação criada no teste público
  await page.goto("/admin/agenda?view=lista&status=pending");
  await page.getByRole("link", { name: /Abrir/ }).first().click();
  await expect(page.getByText("Aguardando confirmação").first()).toBeVisible();
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();
  await expect(page.getByText("Status atualizado.")).toBeVisible();
  await expect(page.getByText("Confirmado").first()).toBeVisible();
  await expect(page.getByText(/Status alterado: aguardando → confirmado/)).toBeVisible();

  // notificação sem provedor configurado vira pendência manual (não é simulada)
  await page.goto("/admin/notificacoes");
  await expect(page.getByText("Envio automático não configurado")).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir no WhatsApp" }).first()).toBeVisible();

  // orçamento: alterar status e registrar estimativa
  await page.goto("/admin/orcamentos");
  await page.getByRole("link", { name: /Cliente Teste/ }).first().click();
  await expect(page.getByAltText("Referência 1 enviada pelo cliente")).toBeVisible();
  await page.getByRole("combobox", { name: "Status", exact: true }).first().selectOption("in_review");
  await page.getByLabel("Estimativa mínima (R$)").fill("400,00");
  await page.getByLabel("Mensagem ao cliente").fill("Ideia ótima! Vamos detalhar.");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Orçamento atualizado.")).toBeVisible();
  await expect(page.getByText("Em análise").first()).toBeVisible();

  // portfólio: adicionar, publicar e verificar no site
  await page.goto("/admin/portfolio/novo");
  await page.locator("input#image").setInputFiles({
    name: "work.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
  });
  await page.getByLabel("Título").fill("Trabalho E2E");
  await page.getByLabel("Texto alternativo").fill("Imagem de teste automatizado do portfólio");
  await page.getByLabel("Categoria / estilo").selectOption({ label: "Fineline" });
  await page.getByLabel("Publicado no site").check();
  await page.getByRole("button", { name: "Adicionar trabalho" }).click();
  await expect(page.getByText("Trabalho adicionado.")).toBeVisible();

  await page.goto("/portfolio");
  await expect(page.getByRole("link", { name: "Trabalho E2E" })).toBeVisible();

  // despublicar remove do site
  await page.goto("/admin/portfolio");
  await page.getByRole("button", { name: "Despublicar" }).click();
  await expect(page.getByRole("button", { name: "Publicar" })).toBeVisible();
  await page.goto("/portfolio");
  await expect(page.getByRole("link", { name: "Trabalho E2E" })).toHaveCount(0);

  // sair encerra a sessão
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin/agenda");
  await expect(page).toHaveURL(/\/admin\/login/);
});
