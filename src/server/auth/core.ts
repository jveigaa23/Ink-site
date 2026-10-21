import { and, eq, gt, lt, sql } from "drizzle-orm";
import { adminSessions, adminUsers } from "@/db/schema";
import type { DbLike } from "@/db/types";
import { DUMMY_PASSWORD_HASH, generateToken, hashPassword, keyedHash, sha256, verifyPassword } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { hitRateLimit, resetRateLimit } from "@/server/rate-limit";

export const SESSION_TTL_MS = 7 * 24 * 3_600_000;
/** Renova a validade da sessão quando falta menos que isso para expirar. */
const SESSION_REFRESH_MS = 6 * 24 * 3_600_000;

export const MIN_PASSWORD_LENGTH = 12;

export type AdminIdentity = { id: string; email: string; name: string; role: "owner" | "staff"; sessionId: string };

export function assertStrongPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError("WEAK_PASSWORD", `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (password.length > 200) throw new AppError("WEAK_PASSWORD", "Senha longa demais.");
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (classes < 3) {
    throw new AppError("WEAK_PASSWORD", "Combine ao menos três tipos: minúsculas, maiúsculas, números e símbolos.");
  }
}

/**
 * Autentica com limitação de tentativas por IP e por e-mail.
 * Mensagem de erro genérica e tempo de resposta equalizado evitam enumeração de contas.
 */
export async function login(
  db: DbLike,
  params: { email: string; password: string; ip: string; userAgent?: string | null; now?: Date },
): Promise<{ token: string; user: { id: string; name: string } }> {
  const email = params.email.trim().toLowerCase();
  const ipKey = `login:ip:${keyedHash(params.ip)}`;
  const emailKey = `login:email:${keyedHash(email)}`;
  const [byIp, byEmail] = await Promise.all([
    hitRateLimit(db, ipKey, 20, 15 * 60),
    hitRateLimit(db, emailKey, 8, 15 * 60),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    throw new AppError("RATE_LIMITED", "Muitas tentativas. Aguarde 15 minutos e tente novamente.", 429);
  }

  const [user] = await db
    .select()
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = ${email}`);
  const ok = await verifyPassword(params.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !ok || !user.active) {
    throw new AppError("INVALID_CREDENTIALS", "E-mail ou senha incorretos.", 401);
  }

  await resetRateLimit(db, emailKey);
  const now = params.now ?? new Date();
  const token = generateToken();
  await db.insert(adminSessions).values({
    id: sha256(token),
    userId: user.id,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    userAgent: params.userAgent?.slice(0, 200) ?? null,
  });
  await db.update(adminUsers).set({ lastLoginAt: now }).where(eq(adminUsers.id, user.id));
  await audit(db, { type: "admin", id: user.id }, "auth.login", { type: "admin", id: user.id });
  return { token, user: { id: user.id, name: user.name } };
}

/** Valida o token do cookie. Retorna a identidade ou null. Renova sessões ativas (expiração deslizante). */
export async function validateSession(db: DbLike, token: string | undefined, now = new Date()): Promise<AdminIdentity | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const id = sha256(token);
  const [row] = await db
    .select({ session: adminSessions, user: adminUsers })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.userId))
    .where(and(eq(adminSessions.id, id), gt(adminSessions.expiresAt, now)));
  if (!row || !row.user.active) return null;
  if (row.session.expiresAt.getTime() - now.getTime() < SESSION_REFRESH_MS) {
    await db
      .update(adminSessions)
      .set({ expiresAt: new Date(now.getTime() + SESSION_TTL_MS), lastSeenAt: now })
      .where(eq(adminSessions.id, id));
  }
  return { id: row.user.id, email: row.user.email, name: row.user.name, role: row.user.role, sessionId: id };
}

export async function revokeSession(db: DbLike, token: string) {
  await db.delete(adminSessions).where(eq(adminSessions.id, sha256(token)));
}

export async function revokeAllSessions(db: DbLike, userId: string, exceptSessionId?: string) {
  const rows = await db.select({ id: adminSessions.id }).from(adminSessions).where(eq(adminSessions.userId, userId));
  for (const r of rows) {
    if (r.id !== exceptSessionId) await db.delete(adminSessions).where(eq(adminSessions.id, r.id));
  }
}

export async function purgeExpiredSessions(db: DbLike, now = new Date()) {
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, now));
}

export async function changePassword(
  db: DbLike,
  params: { userId: string; currentPassword: string; newPassword: string; keepSessionId: string },
) {
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, params.userId));
  if (!user || !(await verifyPassword(params.currentPassword, user.passwordHash))) {
    throw new AppError("INVALID_CREDENTIALS", "Senha atual incorreta.", 401, { currentPassword: "Senha atual incorreta." });
  }
  assertStrongPassword(params.newPassword);
  await db.update(adminUsers).set({ passwordHash: await hashPassword(params.newPassword) }).where(eq(adminUsers.id, user.id));
  await revokeAllSessions(db, user.id, params.keepSessionId);
  await audit(db, { type: "admin", id: user.id }, "auth.password_changed", { type: "admin", id: user.id });
}

/** Usado apenas pelo script de provisionamento (linha de comando). */
export async function createAdminUser(db: DbLike, params: { email: string; name: string; password: string; role?: "owner" | "staff" }) {
  assertStrongPassword(params.password);
  const [row] = await db
    .insert(adminUsers)
    .values({
      email: params.email.trim().toLowerCase(),
      name: params.name.trim(),
      passwordHash: await hashPassword(params.password),
      role: params.role ?? "owner",
    })
    .returning({ id: adminUsers.id });
  return row.id;
}

export async function setAdminPassword(db: DbLike, email: string, password: string) {
  assertStrongPassword(password);
  const [user] = await db.select().from(adminUsers).where(sql`lower(${adminUsers.email}) = ${email.trim().toLowerCase()}`);
  if (!user) throw new AppError("NOT_FOUND", "Administrador não encontrado.", 404);
  await db.update(adminUsers).set({ passwordHash: await hashPassword(password), active: true }).where(eq(adminUsers.id, user.id));
  await revokeAllSessions(db, user.id);
}
