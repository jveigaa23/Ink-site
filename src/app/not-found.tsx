import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grain flex min-h-dvh flex-col items-start justify-center gap-8 px-6 sm:px-16">
      <p className="eyebrow">Erro 404</p>
      <h1 className="display text-[clamp(3.5rem,12vw,10rem)]">
        Página <em className="text-bone-dim">não encontrada</em>
      </h1>
      <p className="max-w-md text-mute">O endereço pode ter mudado, ou o link de acompanhamento está incompleto.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={buttonClass("primary")}>
          Ir para o início
        </Link>
        <Link href="/portfolio" className={buttonClass("secondary")}>
          Ver portfólio
        </Link>
      </div>
    </main>
  );
}
