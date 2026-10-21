"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { submitQuoteAction } from "@/app/actions/public";
import { fieldErrors, quoteRequestSchema, SIZE_OPTIONS } from "@/lib/validation";
import { compressImage } from "@/lib/client-image";
import { idle, type ActionState } from "@/server/action-result";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { ContactFields } from "./contact-fields";

const MAX_FILES = 3;

export function QuoteForm({ styles, referencesEnabled }: { styles: string[]; referencesEnabled: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitQuoteAction, idle);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);
  const errors = clientErrors ?? (state.status === "error" ? state.fieldErrors : undefined);

  function onFiles(list: FileList | null) {
    setFileError("");
    const chosen = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (chosen.length > MAX_FILES) setFileError(`Selecione no máximo ${MAX_FILES} imagens.`);
    setFiles(chosen.slice(0, MAX_FILES));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const check = quoteRequestSchema.safeParse({
      contact: {
        name: fd.get("name"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        privacyConsent: fd.get("privacyConsent") === "on",
      },
      style: fd.get("style"),
      bodyPart: fd.get("bodyPart"),
      size: fd.get("size"),
      description: fd.get("description"),
      preferredDates: fd.get("preferredDates"),
      extraInfo: fd.get("extraInfo"),
    });
    if (!check.success) {
      setClientErrors(fieldErrors(check.error));
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setClientErrors(null);
    // lê do próprio campo (não do estado), cobrindo seleção feita antes da hidratação
    const chosen = fd.getAll("references").filter((f): f is File => f instanceof File && f.size > 0 && f.type.startsWith("image/"));
    if (chosen.length > MAX_FILES) {
      setFileError(`Selecione no máximo ${MAX_FILES} imagens.`);
      return;
    }
    fd.delete("references");
    setPreparing(true);
    try {
      for (const f of chosen) fd.append("references", await compressImage(f));
    } finally {
      setPreparing(false);
    }
    startTransition(() => action(fd));
  }

  const busy = pending || preparing;

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-12" aria-describedby="form-status">
      <div id="form-status" aria-live="polite">
        {state.status === "error" ? (
          <Notice tone="danger" role="alert" title="Não foi possível enviar">
            {state.message}
          </Notice>
        ) : null}
      </div>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="eyebrow mb-5">Sua ideia</legend>
        <TextField
          label="Estilo desejado"
          name="style"
          required
          list="style-options"
          maxLength={80}
          placeholder="Ex.: fineline, blackwork, realismo"
          error={errors?.style}
        />
        {styles.length ? (
          <datalist id="style-options">
            {styles.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        ) : null}
        <TextField label="Parte do corpo" name="bodyPart" required maxLength={80} placeholder="Ex.: antebraço interno" error={errors?.bodyPart} />
        <SelectField label="Tamanho aproximado" name="size" required defaultValue="" error={errors?.size} className="sm:col-span-2">
          <option value="" disabled>
            Selecione
          </option>
          {SIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <TextArea
          label="Descreva sua ideia"
          name="description"
          required
          rows={6}
          minLength={20}
          maxLength={3000}
          hint="Elementos, significado, referências de estilo, se é cobertura, etc."
          error={errors?.description}
          className="sm:col-span-2"
        />
        <TextField
          label="Preferência de datas (opcional)"
          name="preferredDates"
          maxLength={300}
          placeholder="Ex.: sábados à tarde, a partir de março"
          error={errors?.preferredDates}
          className="sm:col-span-2"
        />

        {referencesEnabled ? (
        <div className="sm:col-span-2">
          <label htmlFor="references" className="text-sm font-medium text-bone-dim">
            Referências visuais (opcional)
          </label>
          <p id="references-hint" className="mt-1 text-xs text-faint">
            Até {MAX_FILES} imagens (JPG, PNG ou WebP). Elas são privadas e nunca publicadas no portfólio.
          </p>
          <input
            ref={fileInput}
            id="references"
            name="references"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            aria-describedby="references-hint"
            onChange={(e) => onFiles(e.target.files)}
            className="mt-3 block w-full text-sm text-mute file:mr-4 file:min-h-11 file:cursor-pointer file:rounded-sm file:border file:border-ink-600 file:bg-ink-850 file:px-4 file:text-bone hover:file:border-bone/60"
          />
          {fileError ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {fileError}
            </p>
          ) : null}
          {files.length ? (
            <ul className="mt-3 flex flex-wrap gap-2 text-xs text-mute">
              {files.map((f) => (
                <li key={f.name + f.size} className="rounded-full border border-ink-600 px-3 py-1">
                  {f.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        ) : null}

        <TextArea label="Informações adicionais (opcional)" name="extraInfo" rows={3} maxLength={1500} error={errors?.extraInfo} className="sm:col-span-2" />
      </fieldset>

      <ContactFields errors={errors} />

      <div className="flex flex-col gap-4 border-t border-ink-700 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-xs text-faint">
          Você receberá um protocolo e um link para acompanhar o pedido. Nenhum valor é cobrado nesta etapa.
        </p>
        <Button type="submit" size="lg" disabled={busy} aria-busy={busy}>
          {preparing ? "Preparando imagens…" : pending ? "Enviando…" : "Enviar pedido"}
        </Button>
      </div>
    </form>
  );
}
