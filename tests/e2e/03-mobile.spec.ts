import { expect, test } from "@playwright/test";

test("uso básico em celular: menu, portfólio e agendamento", async ({ page }) => {
  await page.goto("/");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width); // sem rolagem horizontal
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: /Serviços/ }).click();
  await expect(page).toHaveURL(/\/servicos$/);
  await page.goto("/agendar");
  await page.getByRole("group", { name: "Escolha uma data" }).getByRole("button").nth(2).click();
  await expect(page.locator("ul button[aria-pressed]").first()).toBeVisible();
  const box = await page.locator("ul button[aria-pressed]").first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44); // alvo de toque confortável
});
