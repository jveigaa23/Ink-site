import { existsSync, readFileSync } from "node:fs";

/** Lê TEST_DATABASE_URL do ambiente ou de .env.local (sem expor outras variáveis). */
export function loadTestEnv(): string | undefined {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (existsSync(".env.local")) {
    const line = readFileSync(".env.local", "utf8")
      .split("\n")
      .find((l) => l.startsWith("TEST_DATABASE_URL="));
    if (line) process.env.TEST_DATABASE_URL = line.slice("TEST_DATABASE_URL=".length).trim();
  }
  return process.env.TEST_DATABASE_URL;
}
