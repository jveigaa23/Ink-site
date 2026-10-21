import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../../src/db/create";
import { loadTestEnv } from "./env";

/** Recria o schema do banco de TESTE do zero e aplica as migrações versionadas. */
export default async function setup() {
  const url = loadTestEnv();
  if (!url) {
    console.warn("[tests] TEST_DATABASE_URL ausente — testes de integração serão ignorados.");
    return;
  }
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error("TEST_DATABASE_URL deve apontar para um banco cujo nome contenha 'test'.");
  }
  const { db, sql } = createDb(url, { max: 1 });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await migrate(db, { migrationsFolder: "./drizzle" });
  await sql.end();
}
