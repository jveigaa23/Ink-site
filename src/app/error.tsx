"use client";

import { buttonClass } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-start justify-center gap-6 px-6 py-20 sm:px-16">
      <p className="eyebrow">Algo deu errado</p>
      <h1 className="display text-5xl sm:text-7xl">Não foi possível carregar esta página.</h1>
      <p className="max-w-md text-mute">Tente novamente. Se o problema continuar, volte mais tarde.</p>
      <button type="button" onClick={reset} className={buttonClass("secondary")}>
        Tentar novamente
      </button>
    </main>
  );
}
