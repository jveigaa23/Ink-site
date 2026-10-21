"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NAV } from "./nav-config";

/** Menu móvel em <dialog> nativo: foco preso, Esc fecha e o foco volta ao botão. */
export function MobileNav({ bookingEnabled }: { bookingEnabled: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center text-bone md:hidden"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="sr-only">Abrir menu</span>
        <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true">
          <path d="M1 2h24M8 12h17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-label="Menu"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-ink-950 p-0 text-bone backdrop:bg-transparent"
      >
        <div className="flex h-full flex-col px-6 pt-5 pb-10">
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center"
              onClick={() => setOpen(false)}
              autoFocus
            >
              <span className="sr-only">Fechar menu</span>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M2 2l16 16M18 2L2 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <nav aria-label="Principal" className="mt-8 flex flex-1 flex-col gap-1">
            {NAV.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="display flex items-baseline gap-4 py-2 text-5xl"
              >
                <span className="font-sans text-xs tracking-widest text-faint">{String(i + 1).padStart(2, "0")}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            {bookingEnabled ? (
              <Link
                href="/agendar"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-13 items-center justify-center bg-accent text-sm font-semibold uppercase tracking-[0.16em] text-accent-contrast"
              >
                Agendar sessão
              </Link>
            ) : null}
            <Link
              href="/orcamento"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-13 items-center justify-center border border-bone/30 text-sm font-semibold uppercase tracking-[0.16em]"
            >
              Solicitar orçamento
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
