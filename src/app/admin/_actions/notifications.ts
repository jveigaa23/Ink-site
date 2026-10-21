"use server";

import { z } from "zod";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth/session";
import { setManualStatus } from "@/server/notifications";

export async function setManualNotificationAction(fd: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(fd.get("id"));
  const status = z.enum(["manual_done", "dismissed", "manual_pending"]).parse(fd.get("status"));
  await setManualStatus(getDb(), id, status);
}
