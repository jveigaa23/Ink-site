import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false, follow: false } };

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="eyebrow mb-3">Área restrita</p>
        <h1 className="display mb-10 text-5xl">Painel do estúdio</h1>
        <Suspense fallback={null}>
          <Form searchParams={searchParams} />
        </Suspense>
        <p className="mt-8 text-xs text-faint">
          Acesso exclusivo para administradores. Sem acesso? O primeiro administrador é criado pelo comando{" "}
          <code className="text-mute">npm run admin:create</code>.
        </p>
      </div>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginForm next={next ?? "/admin"} />;
}
