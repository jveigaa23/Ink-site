import { expect, type Page } from "@playwright/test";

export const ADMIN = { email: "admin@e2e.test", password: process.env.E2E_ADMIN_PASSWORD! };

export async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
}

/** Aguarda o tempo mínimo antispam do formulário. */
export const waitHuman = (page: Page) => page.waitForTimeout(2700);

export async function fillContact(page: Page, name = "Cliente Teste") {
  await page.getByRole("textbox", { name: /^Nome/ }).fill(name);
  await page.getByLabel("E-mail").fill("cliente@example.com");
  await page.getByLabel("WhatsApp / telefone").fill("(11) 98888-7777");
  await page.getByLabel(/Concordo com o uso dos meus dados/).check();
}
