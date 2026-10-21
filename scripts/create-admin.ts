import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createDb } from "../src/db/create";
import { createAdminUser, setAdminPassword } from "../src/server/auth/core";

/**
 * Provisionamento seguro de administradores (sem senha padrão no código).
 *   npm run admin:create            → cria um administrador (pergunta e-mail, nome e senha)
 *   npm run admin:create -- --reset → redefine a senha de um administrador existente
 * Em ambientes não interativos, use ADMIN_EMAIL, ADMIN_NAME e ADMIN_PASSWORD.
 */
async function askHidden(rl: ReturnType<typeof createInterface>, q: string) {
  const out = stdout as unknown as { write: (s: string) => boolean };
  const origWrite = out.write.bind(out);
  let muted = false;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
    if (!muted) origWrite(s);
  };
  const p = rl.question(q);
  muted = true;
  const answer = await p;
  muted = false;
  origWrite("\n");
  return answer;
}

async function main() {
  const reset = process.argv.includes("--reset");
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  const interactive = stdin.isTTY && !process.env.ADMIN_PASSWORD;
  const rl = interactive ? createInterface({ input: stdin, output: stdout, terminal: true }) : null;

  const email = process.env.ADMIN_EMAIL || (rl ? await rl.question("E-mail do administrador: ") : "");
  const name = reset ? "" : process.env.ADMIN_NAME || (rl ? await rl.question("Nome: ") : "");
  let password = process.env.ADMIN_PASSWORD || "";
  if (!password && rl) {
    password = await askHidden(rl, "Senha (mín. 12 caracteres): ");
    const confirm = await askHidden(rl, "Confirme a senha: ");
    if (password !== confirm) throw new Error("As senhas não conferem.");
  }
  rl?.close();
  if (!email || !password || (!reset && !name)) throw new Error("E-mail, nome e senha são obrigatórios.");

  const { db, sql } = createDb(url, { max: 1 });
  try {
    if (reset) {
      await setAdminPassword(db, email, password);
      console.log("Senha redefinida. Todas as sessões desse administrador foram encerradas.");
    } else {
      await createAdminUser(db, { email, name, password });
      console.log("Administrador criado. Acesse /admin/login.");
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
