"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { createPortfolioAction, updatePortfolioAction } from "@/app/admin/_actions/portfolio";
import type { ActionState } from "@/server/action-result";
import { compressImage } from "@/lib/client-image";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextArea, TextField } from "@/components/ui/field";

type Item = {
  id: string;
  title: string;
  description: string;
  altText: string;
  categoryId: string | null;
  featured: boolean;
  published: boolean;
  isDemo: boolean;
  imageUrl: string;
};

/** Formulário de trabalho com prévia de como aparecerá no site antes de publicar. */
export function PortfolioForm({ item, categories }: { item?: Item; categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(item ? updatePortfolioAction : createPortfolioAction, { status: "idle" });
  const [preview, setPreview] = useState<string | null>(item?.imageUrl ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(item?.title ?? "");
  const [preparing, setPreparing] = useState(false);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prévia local do arquivo escolhido
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // lê do próprio campo (não do estado), cobrindo seleção feita antes da hidratação
    const chosen = fd.get("image");
    fd.delete("image");
    if (chosen instanceof File && chosen.size > 0) {
      setPreparing(true);
      fd.append("image", await compressImage(chosen, 2400, 0.9));
      setPreparing(false);
    }
    startTransition(() => action(fd));
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <div>
          <label htmlFor="image" className="text-sm font-medium text-bone-dim">
            Imagem {item ? "(envie outra para substituir)" : <span className="text-accent">*</span>}
          </label>
          <input
            id="image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            aria-describedby="image-hint"
            className="mt-2 block w-full text-sm text-mute file:mr-4 file:min-h-11 file:rounded-sm file:border file:border-ink-600 file:bg-ink-850 file:px-4 file:text-bone"
          />
          <p id="image-hint" className="mt-1 text-xs text-faint">
            Use fotografias reais do estúdio. A imagem é otimizada e os metadados (incl. localização) são removidos.
          </p>
          {errors?.image ? <p role="alert" className="mt-1 text-sm text-danger">{errors.image}</p> : null}
        </div>
        <TextField label="Título" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} error={errors?.title} />
        <TextField
          label="Texto alternativo"
          name="altText"
          required
          defaultValue={item?.altText}
          error={errors?.altText}
          hint="Descreva a imagem para quem usa leitor de tela. Ex.: “Tatuagem fineline de ramo de oliveira no antebraço”."
        />
        <SelectField label="Categoria / estilo" name="categoryId" defaultValue={item?.categoryId ?? ""}>
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextArea label="Descrição (opcional)" name="description" rows={3} defaultValue={item?.description} />
        <div className="flex flex-wrap gap-6">
          <CheckboxField name="published" defaultChecked={item?.published ?? false} label="Publicado no site" />
          <CheckboxField name="featured" defaultChecked={item?.featured ?? false} label="Destaque na página inicial" />
          <CheckboxField name="isDemo" defaultChecked={item?.isDemo ?? false} label="Imagem demonstrativa (exibe aviso)" />
        </div>
        {state.status === "error" ? <Notice tone="danger" role="alert">{state.message}</Notice> : null}
        {state.status === "success" ? <Notice tone="success" role="status">{state.message}</Notice> : null}
        <Button type="submit" disabled={pending || preparing}>
          {preparing ? "Otimizando imagem…" : pending ? "Salvando…" : item ? "Salvar" : "Adicionar trabalho"}
        </Button>
      </div>
      <aside className="lg:col-span-2" aria-label="Prévia">
        <p className="mb-3 text-xs uppercase tracking-wider text-mute">Prévia no site</p>
        <div className="rounded-sm border border-ink-700 bg-ink-950 p-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-auto w-full" />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-ink-850 text-sm text-faint">Sem imagem</div>
          )}
          <p className="mt-3 text-sm text-bone">{title || "Título do trabalho"}</p>
        </div>
      </aside>
    </form>
  );
}
