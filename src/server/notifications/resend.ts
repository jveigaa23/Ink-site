import { env } from "@/server/env";

/** Envio de e-mail pela API HTTP do Resend (sem SDK). Lança erro em qualquer falha. */
export async function sendEmail(msg: { to: string; subject: string; text: string; fromName: string }) {
  const apiKey = env.resendApiKey();
  const from = env.emailFrom();
  if (!apiKey || !from) throw new Error("Provedor de e-mail não configurado.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: from.includes("<") ? from : `${msg.fromName} <${from}>`,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend respondeu ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { id?: string };
    return { id: data.id ?? "" };
  } finally {
    clearTimeout(timer);
  }
}
