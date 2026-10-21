import sharp from "sharp";
import { createDb } from "../src/db/create";
import { businessHours, portfolioCategories, services } from "../src/db/schema";
import { createItem } from "../src/server/portfolio/service";

/**
 * Dados DEMONSTRATIVOS para desenvolvimento e validação visual.
 * - Imagens abstratas geradas (traços de tinta), marcadas como `isDemo` e exibidas com aviso.
 * - Serviços sem preço (“sob avaliação”) e expediente genérico: ajuste tudo no painel.
 * Recusa executar em produção, a menos que --force seja informado conscientemente.
 */
const PALETTE = ["#ece8e1", "#c9c4bb", "#b8442e"];

function inkSvg(seed: number, w: number, h: number) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const paths = Array.from({ length: 7 }, () => {
    const pts = Array.from({ length: 5 }, () => `${Math.round(rnd() * w)} ${Math.round(rnd() * h)}`);
    const color = PALETTE[Math.floor(rnd() * PALETTE.length)];
    return `<path d="M${pts[0]} C${pts[1]} ${pts[2]} ${pts[3]} S${pts[4]} ${pts[0]}" stroke="${color}" stroke-width="${2 + rnd() * 14}" stroke-opacity="${0.35 + rnd() * 0.6}" fill="none" stroke-linecap="round"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#141414"/>${paths}<text x="40" y="${h - 40}" fill="#7d7871" font-family="sans-serif" font-size="28">IMAGEM DEMONSTRATIVA</text></svg>`;
}

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    throw new Error("Seed demonstrativo bloqueado em produção.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  const { db, sql } = createDb(url, { max: 1 });
  try {
    const existing = await db.select().from(services);
    if (!existing.length) {
      await db.insert(services).values([
        { slug: "sessao-curta", name: "Sessão curta", description: "Projetos pequenos e delicados.", durationMinutes: 120, sortOrder: 10 },
        { slug: "sessao-longa", name: "Sessão longa", description: "Projetos médios e grandes, em uma ou mais sessões.", durationMinutes: 300, sortOrder: 20 },
        { slug: "avaliacao", name: "Conversa de avaliação", description: "Conversa presencial para alinhar o projeto.", durationMinutes: 30, sortOrder: 30 },
      ]);
    }
    const hours = await db.select().from(businessHours);
    if (!hours.length) {
      await db.insert(businessHours).values(
        [2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 10 * 60, endMinute: 19 * 60 })),
      );
    }
    let cats = await db.select().from(portfolioCategories);
    if (!cats.length) {
      cats = await db
        .insert(portfolioCategories)
        .values([
          { slug: "fineline", name: "Fineline", sortOrder: 1 },
          { slug: "blackwork", name: "Blackwork", sortOrder: 2 },
          { slug: "ornamental", name: "Ornamental", sortOrder: 3 },
        ])
        .returning();
    }
    const sizes = [
      [1200, 1500],
      [1200, 1200],
      [1200, 1600],
      [1600, 1200],
      [1200, 1500],
      [1200, 900],
      [1100, 1400],
    ];
    for (let i = 0; i < sizes.length; i++) {
      const [w, h] = sizes[i];
      const buf = await sharp(Buffer.from(inkSvg(i + 7, w, h))).jpeg().toBuffer();
      await createItem(db, {
        fields: {
          title: `Estudo de traço ${String(i + 1).padStart(2, "0")}`,
          description: "Imagem gerada automaticamente para demonstração do layout. Substitua por fotografias reais.",
          altText: `Composição abstrata de traços de tinta, imagem demonstrativa ${i + 1}`,
          categoryId: cats[i % cats.length].id,
          featured: i < 5,
          published: true,
          isDemo: true,
        },
        file: new File([new Uint8Array(buf)], "demo.jpg", { type: "image/jpeg" }),
        actor: { type: "system" },
      });
    }
    console.log("Dados demonstrativos criados.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
