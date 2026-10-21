"use client";

import { buttonClass } from "@/components/ui/button";

/** Botão de envio que pede confirmação antes de uma ação destrutiva. */
export function ConfirmSubmit({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className={buttonClass("danger", "sm")}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
