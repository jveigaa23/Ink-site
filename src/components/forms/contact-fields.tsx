"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckboxField, TextField } from "@/components/ui/field";

/** Campos de contato reutilizados nos formulários públicos + barreiras antispam. */
export function ContactFields({ errors }: { errors?: Record<string, string> }) {
  const e = (k: string) => errors?.[`contact.${k}`] ?? errors?.[k];
  return (
    <fieldset className="grid gap-5 sm:grid-cols-2">
      <legend className="eyebrow mb-5">Seus dados</legend>
      <TextField label="Nome" name="name" autoComplete="name" required maxLength={80} error={e("name")} className="sm:col-span-2" />
      <TextField label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" maxLength={200} error={e("email")} />
      <TextField
        label="WhatsApp / telefone"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="(11) 90000-0000"
        maxLength={20}
        error={e("phone")}
        hint="Informe ao menos e-mail ou telefone."
      />
      <CheckboxField
        name="privacyConsent"
        required
        className="sm:col-span-2"
        error={e("privacyConsent")}
        label={
          <>
            Concordo com o uso dos meus dados para atendimento desta solicitação, conforme o{" "}
            <Link href="/privacidade" target="_blank" className="text-bone underline underline-offset-4">
              aviso de privacidade
            </Link>
            .
          </>
        }
      />
      <AntiSpam />
    </fieldset>
  );
}

function AntiSpam() {
  const [startedAt, setStartedAt] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- registra o momento de montagem no navegador
  useEffect(() => setStartedAt(String(Date.now())), []);
  return (
    <>
      <input type="hidden" name="startedAt" value={startedAt} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Não preencha este campo
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
    </>
  );
}
