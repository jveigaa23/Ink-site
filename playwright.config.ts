import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * Testes E2E contra um banco ISOLADO (E2E_DATABASE_URL, nome deve conter "e2e").
 * A senha do administrador de teste é gerada a cada execução — nunca há senha fixa.
 */
function fromEnvFile(key: string) {
  if (process.env[key]) return process.env[key];
  if (!existsSync(".env.local")) return undefined;
  const line = readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim();
}

process.env.E2E_ADMIN_PASSWORD ??= `E2e-${randomBytes(12).toString("base64url")}!9`;
const dbUrl = fromEnvFile("E2E_DATABASE_URL");
const PORT = 3200;
const chromium = existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
  ? { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }
  : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    launchOptions: chromium,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: chromium }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: chromium }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: `npx tsx tests/e2e/prepare.ts && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: dbUrl ?? "",
      E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
      AUTH_SECRET: randomBytes(32).toString("hex"),
      APP_URL: `http://localhost:${PORT}`,
      ALLOW_LOCAL_STORAGE: "1", // armazenamento em disco somente para o teste
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
    },
  },
});
