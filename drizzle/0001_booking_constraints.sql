-- Garantia definitiva contra agendamentos sobrepostos, inclusive com requisições simultâneas.
-- Considera somente status que ocupam a agenda. O intervalo inclui o tempo de preparo
-- entre sessões (blocked_until). Disponível no PostgreSQL gerenciado (Neon, Supabase etc.).
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (tstzrange("starts_at", "blocked_until", '[)') WITH &&)
  WHERE ("status" IN ('held', 'pending', 'confirmed'));
