"use client";

import { useState } from "react";
import { deleteServiceAction, saveServiceAction } from "@/app/admin/_actions/catalog";
import { ActionForm } from "./action-form";
import { CheckboxField, SelectField, TextArea, TextField } from "@/components/ui/field";

export type ServiceRow = {
  id?: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceType: "on_request" | "from" | "fixed";
  price: string;
  bookableOnline: boolean;
  active: boolean;
  sortOrder: number;
};

export function ServiceForm({ service }: { service?: ServiceRow }) {
  const [priceType, setPriceType] = useState(service?.priceType ?? "on_request");
  return (
    <div className="space-y-3">
      <ActionForm action={saveServiceAction} submitLabel={service?.id ? "Salvar serviço" : "Adicionar serviço"} resetOnSuccess={!service?.id}>
        {(errors) => (
          <>
            {service?.id ? <input type="hidden" name="id" value={service.id} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Nome" name="name" required defaultValue={service?.name} error={errors?.name} />
              <TextField label="Duração (min)" name="durationMinutes" type="number" min={15} max={720} step={15} required defaultValue={service?.durationMinutes ?? 120} error={errors?.durationMinutes} />
              <SelectField label="Preço" name="priceType" value={priceType} onChange={(e) => setPriceType(e.target.value as ServiceRow["priceType"])}>
                <option value="on_request">Sob avaliação (não exibir valor)</option>
                <option value="from">A partir de</option>
                <option value="fixed">Valor fixo</option>
              </SelectField>
              {priceType !== "on_request" ? (
                <TextField label="Valor (R$)" name="price" inputMode="decimal" required defaultValue={service?.price} error={errors?.price ?? errors?.priceCents} placeholder="350,00" />
              ) : null}
              <TextArea label="Descrição" name="description" rows={2} defaultValue={service?.description} className="sm:col-span-2" />
              <TextField label="Ordem de exibição" name="sortOrder" type="number" min={0} defaultValue={service?.sortOrder ?? 0} />
            </div>
            <div className="flex flex-wrap gap-6">
              <CheckboxField name="active" defaultChecked={service?.active ?? true} label="Ativo (visível no site)" />
              <CheckboxField name="bookableOnline" defaultChecked={service?.bookableOnline ?? true} label="Permite agendamento online" />
            </div>
          </>
        )}
      </ActionForm>
      {service?.id ? (
        <ActionForm action={deleteServiceAction} submitLabel="Excluir serviço" variant="ghost" size="sm" confirm="Excluir este serviço? Serviços com agendamentos só podem ser desativados.">
          <input type="hidden" name="id" value={service.id} />
        </ActionForm>
      ) : null}
    </div>
  );
}
