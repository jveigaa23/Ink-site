/**
 * Acesso centralizado às variáveis de ambiente do servidor.
 * Nunca importe este módulo em componentes cliente.
 */
const isProd = process.env.NODE_ENV === "production";

export const env = {
  get appUrl(): string {
    const raw =
      process.env.APP_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
      "http://localhost:3000";
    return raw.replace(/\/+$/, "");
  },
  get authSecret(): string {
    const s = process.env.AUTH_SECRET;
    if (s && s.length >= 32) return s;
    if (isProd && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error("AUTH_SECRET ausente ou curta (mínimo de 32 caracteres).");
    }
    return "development-only-secret-not-for-production-use";
  },
  blobPublicToken: () => process.env.BLOB_READ_WRITE_TOKEN || "",
  blobPrivateToken: () => process.env.BLOB_PRIVATE_READ_WRITE_TOKEN || "",
  resendApiKey: () => process.env.RESEND_API_KEY || "",
  emailFrom: () => process.env.EMAIL_FROM || "",
  cronSecret: () => process.env.CRON_SECRET || "",
  isProd,
};

export const emailProviderConfigured = () => Boolean(env.resendApiKey() && env.emailFrom());
