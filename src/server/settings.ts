import { eq } from "drizzle-orm";
import { settings } from "@/db/schema";
import type { DbLike } from "@/db/types";
import { SETTINGS, type SettingsKey, type SettingsValue } from "@/config/settings-schema";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Mescla valores salvos com os padrões (um nível de profundidade para objetos aninhados). */
function mergeDefaults<T extends Record<string, unknown>>(defaults: T, stored: unknown): T {
  if (!isPlainObject(stored)) return defaults;
  const out: Record<string, unknown> = { ...defaults };
  for (const [k, v] of Object.entries(stored)) {
    if (!(k in defaults)) continue;
    const d = (defaults as Record<string, unknown>)[k];
    out[k] = isPlainObject(d) && isPlainObject(v) ? { ...d, ...v } : v;
  }
  return out as T;
}

export async function getSettings<K extends SettingsKey>(db: DbLike, key: K): Promise<SettingsValue<K>> {
  const def = SETTINGS[key];
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key));
  const merged = mergeDefaults(def.defaults as Record<string, unknown>, row?.value);
  const parsed = def.schema.safeParse(merged);
  if (parsed.success) return parsed.data as SettingsValue<K>;
  console.error(`[settings] valor inválido para "${key}"; usando padrões.`);
  return def.defaults as SettingsValue<K>;
}

export async function saveSettings<K extends SettingsKey>(
  db: DbLike,
  key: K,
  value: SettingsValue<K>,
): Promise<SettingsValue<K>> {
  const parsed = SETTINGS[key].schema.parse(value) as SettingsValue<K>;
  await db
    .insert(settings)
    .values({ key, value: parsed })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed, updatedAt: new Date() } });
  return parsed;
}
