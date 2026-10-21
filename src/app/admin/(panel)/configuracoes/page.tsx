import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth/session";
import { getBusinessHours } from "@/server/catalog";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings";
import { WEEKDAY_NAMES } from "@/lib/contact";
import { minutesToHHMM } from "@/lib/time";
import type { MediaRef } from "@/config/settings-schema";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { ActionForm } from "@/components/admin/action-form";
import { Notice } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextArea, TextField } from "@/components/ui/field";
import { changePasswordAction } from "../../_actions/auth";
import {
  removeSiteImageAction,
  saveBookingRulesAction,
  saveContactAction,
  saveContentAction,
  saveHoursAction,
  saveIdentityAction,
  saveNotificationPrefsAction,
  uploadSiteImageAction,
} from "../../_actions/settings";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Configurações" };

const TABS = [
  { id: "identidade", label: "Identidade" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "contato", label: "Contato" },
  { id: "imagens", label: "Imagens" },
  { id: "agenda", label: "Agenda" },
  { id: "notificacoes", label: "Notificações e privacidade" },
  { id: "conta", label: "Conta" },
] as const;

const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Belem", "America/Fortaleza", "America/Recife", "America/Bahia", "America/Porto_Velho", "America/Rio_Branco", "America/Noronha", "Europe/Lisbon"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await requireAdmin();
  const { aba } = await searchParams;
  const tab = TABS.find((t) => t.id === aba)?.id ?? "identidade";
  const db = getDb();
  const [studio, booking, notif, privacy, hours] = await Promise.all([
    getSettings(db, "studio"),
    getSettings(db, "booking"),
    getSettings(db, "notifications"),
    getSettings(db, "privacy"),
    getBusinessHours(db),
  ]);

  return (
    <>
      <PageHeader title="Configurações" description="Alterações são publicadas no site imediatamente após salvar." />
      <nav aria-label="Seções" className="-mx-4 mb-8 flex gap-1 overflow-x-auto border-b border-ink-700 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/configuracoes?aba=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm ${tab === t.id ? "border-accent text-bone" : "border-transparent text-mute hover:text-bone"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "identidade" ? (
        <Panel>
          <ActionForm action={saveIdentityAction} submitLabel="Salvar identidade">
            <>
                                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Nome do estúdio" name="name" required maxLength={80} defaultValue={studio.name} />
                  <TextField label="Linha de apoio (tagline)" name="tagline" maxLength={140} defaultValue={studio.tagline} />
                </div>
                <CheckboxField name="namePending" defaultChecked={studio.namePending} label="O nome ainda é provisório (lembrete no painel)" />
                <TextField label="Chamada principal" name="heroTitle" maxLength={120} defaultValue={studio.heroTitle} hint="A última palavra aparece em itálico." />
                <TextArea label="Texto de apoio da chamada" name="heroSubtitle" rows={2} maxLength={280} defaultValue={studio.heroSubtitle} />
                <TextArea label="Descrição para buscadores" name="seoDescription" rows={2} maxLength={170} defaultValue={studio.seoDescription} hint="Até 170 caracteres. Não inclua informações não confirmadas." />
                <div className="flex items-end gap-3">
                  <TextField label="Cor de destaque" name="accentColor" defaultValue={studio.accentColor} pattern="#[0-9a-fA-F]{6}" hint="Hexadecimal, ex.: #b8442e. O texto sobre a cor é ajustado automaticamente para manter contraste." />
                  <span aria-hidden="true" className="mb-7 size-11 shrink-0 rounded-sm border border-ink-600" style={{ background: studio.accentColor }} />
                </div>
              </>
          </ActionForm>
        </Panel>
      ) : null}

      {tab === "conteudo" ? (
        <Panel>
          <ActionForm action={saveContentAction} submitLabel="Salvar conteúdo">
            <>
                                <Notice tone="neutral">Não publique certificados, prêmios, anos de experiência ou outras informações que não sejam confirmadas. Campos vazios ficam ocultos no site.</Notice>
                <TextField label="Nome do artista" name="artistName" maxLength={80} defaultValue={studio.artistName} />
                <TextArea label="Biografia do artista" name="artistBio" rows={6} maxLength={4000} defaultValue={studio.artistBio} hint="Separe parágrafos com uma linha em branco." />
                <TextArea label="História do estúdio" name="studioStory" rows={5} maxLength={4000} defaultValue={studio.studioStory} />
                <TextArea label="Especialidades / estilos" name="specialties" rows={3} defaultValue={studio.specialties.join("\n")} hint="Um por linha. Se vazio, o site usa as categorias do portfólio." />
                <TextArea label="Informações sobre o atendimento" name="attendanceInfo" rows={4} maxLength={2000} defaultValue={studio.attendanceInfo} />
                <TextArea label="Cuidados com a tatuagem" name="aftercare" rows={8} maxLength={6000} defaultValue={studio.aftercare} hint="Orientações exibidas na página Cuidados." />
                <TextArea label="Política de sinal" name="depositPolicy" rows={3} maxLength={2000} defaultValue={studio.depositPolicy} hint="Exibida em Serviços. Deixe vazio se o estúdio não cobra sinal." />
                <TextArea label="Política de cancelamento (texto)" name="cancellationPolicyText" rows={3} maxLength={2000} defaultValue={studio.cancellationPolicyText} hint="As regras automáticas ficam na aba Agenda." />
              </>
          </ActionForm>
        </Panel>
      ) : null}

      {tab === "contato" ? (
        <Panel>
          <ActionForm action={saveContactAction} submitLabel="Salvar contatos">
            <>
                                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Instagram (usuário)" name="instagram" defaultValue={studio.contact.instagram} placeholder="seuestudio" />
                  <TextField label="WhatsApp (DDI+DDD+número)" name="whatsapp" defaultValue={studio.contact.whatsapp} placeholder="5511999999999" />
                  <TextField label="Telefone (como exibir)" name="phoneDisplay" defaultValue={studio.contact.phoneDisplay} placeholder="(11) 99999-9999" />
                  <TextField label="E-mail público" name="email" type="email" defaultValue={studio.contact.email} />
                  <TextField label="E-mail para pedidos de privacidade (LGPD)" name="privacyContactEmail" type="email" defaultValue={studio.privacyContactEmail} className="sm:col-span-2" />
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-bone-dim">Outros links (opcional)</legend>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                      <TextField label={`Rótulo ${i + 1}`} name={`linkLabel${i}`} defaultValue={studio.contact.otherLinks[i]?.label} />
                      <TextField label={`Endereço ${i + 1} (https://)`} name={`linkUrl${i}`} defaultValue={studio.contact.otherLinks[i]?.url} />
                    </div>
                  ))}
                </fieldset>
                <fieldset className="grid gap-4 sm:grid-cols-2">
                  <legend className="mb-2 text-sm font-medium text-bone-dim">Endereço</legend>
                  <TextField label="Logradouro e número" name="line1" defaultValue={studio.address.line1} className="sm:col-span-2" />
                  <TextField label="Complemento / bairro" name="line2" defaultValue={studio.address.line2} className="sm:col-span-2" />
                  <TextField label="Cidade" name="city" defaultValue={studio.address.city} />
                  <TextField label="Estado" name="state" defaultValue={studio.address.state} />
                  <TextField label="CEP" name="postalCode" defaultValue={studio.address.postalCode} />
                  <TextField label="Link do mapa (https://)" name="mapsUrl" defaultValue={studio.address.mapsUrl} />
                </fieldset>
                <CheckboxField name="showOnSite" defaultChecked={studio.address.showOnSite} label="Exibir endereço no site" hint="Desmarque se o atendimento é em local privado; o endereço pode ser enviado após a confirmação." />
                <TextField label="Observação sobre horários" name="hoursNote" maxLength={300} defaultValue={studio.hoursNote} placeholder="Ex.: atendimento somente com hora marcada" />
              </>
          </ActionForm>
        </Panel>
      ) : null}

      {tab === "imagens" ? (
        <div className="space-y-6">
          {!env.blobPublicToken() && env.isProd ? <Notice tone="warning">Armazenamento de imagens não configurado (BLOB_READ_WRITE_TOKEN).</Notice> : null}
          <ImageSlot title="Logotipo" slot="logo" current={studio.logo} hint="PNG/WebP com fundo transparente. Substitui o nome em texto no cabeçalho." />
          <ImageSlot title="Imagem principal (página inicial)" slot="heroImage" current={studio.heroImage} hint="Fotografia vertical de alta qualidade. Sem ela, o site exibe uma composição gráfica." />
          <ImageSlot title="Foto do artista" slot="artistPhoto" current={studio.artistPhoto} />
          <Panel title={`Fotos do ambiente (${studio.studioPhotos.length}/12)`}>
            {studio.studioPhotos.length ? (
              <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {studio.studioPhotos.map((p) => (
                  <li key={p.key} className="space-y-2">
                    <div className="relative aspect-square overflow-hidden bg-ink-850">
                      <Image src={p.url} alt={p.alt} fill sizes="200px" className="object-cover" />
                    </div>
                    <form action={removeSiteImageAction}>
                      <input type="hidden" name="slot" value="studioPhotos" />
                      <input type="hidden" name="key" value={p.key} />
                      <button className="text-xs text-danger hover:underline">Remover</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
            <UploadForm slot="studioPhotos" />
          </Panel>
        </div>
      ) : null}

      {tab === "agenda" ? (
        <div className="space-y-6">
          <Panel title="Horário de atendimento">
            <ActionForm action={saveHoursAction} submitLabel="Salvar horários">
              <p className="text-sm text-mute">Até dois intervalos por dia (ex.: manhã e tarde). Use bloqueios para folgas e férias.</p>
              <div className="divide-y divide-ink-700">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const day = hours.filter((h) => h.weekday === d);
                  return (
                    <div key={d} className="grid items-center gap-3 py-3 sm:grid-cols-[140px_1fr_1fr]">
                      <CheckboxField name={`open-${d}`} defaultChecked={day.length > 0} label={WEEKDAY_NAMES[d]} />
                      {[0, 1].map((i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <input type="time" name={`start-${d}-${i}`} aria-label={`${WEEKDAY_NAMES[d]}: início do intervalo ${i + 1}`} defaultValue={day[i] ? minutesToHHMM(day[i].startMinute) : ""} className="min-h-10 rounded-sm border border-ink-600 bg-ink-900 px-2" />
                          <span className="text-faint">às</span>
                          <input type="time" name={`end-${d}-${i}`} aria-label={`${WEEKDAY_NAMES[d]}: fim do intervalo ${i + 1}`} defaultValue={day[i] ? minutesToHHMM(day[i].endMinute % 1440) : ""} className="min-h-10 rounded-sm border border-ink-600 bg-ink-900 px-2" />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </ActionForm>
          </Panel>
          <Panel title="Regras de agendamento">
            <ActionForm action={saveBookingRulesAction} submitLabel="Salvar regras">
              <>
                                    <CheckboxField name="onlineBookingEnabled" defaultChecked={booking.onlineBookingEnabled} label="Agendamento online habilitado" />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <SelectField label="Fuso horário do estúdio" name="timezone" defaultValue={booking.timezone}>
                      {Array.from(new Set([booking.timezone, ...TIMEZONES])).map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </SelectField>
                    <TextField label="Intervalo entre horários (min)" name="slotStepMinutes" type="number" min={15} max={240} step={15} defaultValue={booking.slotStepMinutes} />
                    <TextField label="Preparo entre sessões (min)" name="bufferMinutes" type="number" min={0} max={240} step={5} defaultValue={booking.bufferMinutes} />
                    <TextField label="Antecedência mínima (h)" name="minNoticeHours" type="number" min={0} max={720} defaultValue={booking.minNoticeHours} />
                    <TextField label="Agenda aberta até (dias)" name="maxAdvanceDays" type="number" min={1} max={365} defaultValue={booking.maxAdvanceDays} />
                    <TextField label="Reserva temporária (min)" name="holdMinutes" type="number" min={3} max={30} defaultValue={booking.holdMinutes} hint="Tempo para o cliente preencher os dados." />
                    <TextField label="Prazo para alterações online (h)" name="cancellationNoticeHours" type="number" min={0} max={720} defaultValue={booking.cancellationNoticeHours} hint="Antes da sessão." />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CheckboxField name="autoConfirm" defaultChecked={booking.autoConfirm} label="Confirmar automaticamente solicitações online" hint="Desmarcado: o estúdio confirma cada solicitação." />
                    <CheckboxField name="allowClientCancel" defaultChecked={booking.allowClientCancel} label="Cliente pode cancelar pelo link" />
                    <CheckboxField name="allowClientReschedule" defaultChecked={booking.allowClientReschedule} label="Cliente pode remarcar pelo link" />
                    <CheckboxField name="rescheduleRequiresApproval" defaultChecked={booking.rescheduleRequiresApproval} label="Remarcação exige aprovação do estúdio" />
                    <CheckboxField name="depositRequired" defaultChecked={booking.depositRequired} label="Estúdio cobra sinal (aviso ao cliente)" hint="Não há cobrança automática; o registro do sinal é manual no agendamento." />
                  </div>
                </>
            </ActionForm>
          </Panel>
        </div>
      ) : null}

      {tab === "notificacoes" ? (
        <Panel>
          <ActionForm action={saveNotificationPrefsAction} submitLabel="Salvar preferências">
            <>
                                <CheckboxField name="emailEnabled" defaultChecked={notif.emailEnabled} label="Enviar e-mails aos clientes (quando o provedor estiver configurado)" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="E-mail do estúdio para avisos" name="adminEmail" type="email" defaultValue={notif.adminEmail} />
                  <TextField label="Lembrete antes da sessão (h)" name="reminderHoursBefore" type="number" min={2} max={96} defaultValue={notif.reminderHoursBefore} />
                </div>
                <CheckboxField name="notifyAdminOnNewRequests" defaultChecked={notif.notifyAdminOnNewRequests} label="Avisar o estúdio sobre novas solicitações" />
                <fieldset className="grid gap-4 border-t border-ink-700 pt-4 sm:grid-cols-2">
                  <legend className="mb-2 text-sm font-medium text-bone-dim">Retenção de dados (LGPD)</legend>
                  <TextField label="Excluir orçamentos recusados/arquivados após (meses)" name="quoteRetentionMonths" type="number" min={1} max={120} defaultValue={privacy.quoteRetentionMonths} />
                  <TextField label="Anonimizar clientes inativos após (meses)" name="clientRetentionMonths" type="number" min={6} max={240} defaultValue={privacy.clientRetentionMonths} hint="Sem agendamentos ou pedidos no período." />
                </fieldset>
              </>
          </ActionForm>
        </Panel>
      ) : null}

      {tab === "conta" ? (
        <Panel title="Alterar senha">
          <ActionForm action={changePasswordAction} submitLabel="Alterar senha" resetOnSuccess>
            <div className="grid max-w-md gap-4">
                <TextField label="Senha atual" name="currentPassword" type="password" autoComplete="current-password" required />
                <TextField label="Nova senha" name="newPassword" type="password" autoComplete="new-password" required minLength={12} hint="Mínimo de 12 caracteres, com três tipos entre minúsculas, maiúsculas, números e símbolos." />
                <TextField label="Confirmar nova senha" name="confirm" type="password" autoComplete="new-password" required />
              </div>
          </ActionForm>
        </Panel>
      ) : null}
    </>
  );
}

function ImageSlot({ title, slot, current, hint }: { title: string; slot: "logo" | "heroImage" | "artistPhoto"; current: MediaRef | null; hint?: string }) {
  return (
    <Panel title={title}>
      <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
        <div className="relative aspect-square overflow-hidden rounded-sm border border-ink-700 bg-ink-850">
          {current ? <Image src={current.url} alt={current.alt} fill sizes="200px" className="object-contain" /> : <span className="flex h-full items-center justify-center text-xs text-faint">Sem imagem</span>}
        </div>
        <div className="space-y-3">
          {hint ? <p className="text-sm text-mute">{hint}</p> : null}
          <UploadForm slot={slot} />
          {current ? (
            <form action={removeSiteImageAction}>
              <input type="hidden" name="slot" value={slot} />
              <input type="hidden" name="key" value={current.key} />
              <button className="text-xs text-danger hover:underline">Remover imagem</button>
            </form>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function UploadForm({ slot }: { slot: string }) {
  return (
    <ActionForm action={uploadSiteImageAction} submitLabel="Enviar imagem" variant="secondary" size="sm" resetOnSuccess pendingLabel="Enviando…" compressImages={2400}>
      <input type="hidden" name="slot" value={slot} />
      <div>
        <label htmlFor={`img-${slot}`} className="text-sm text-bone-dim">Arquivo (JPG, PNG ou WebP, até 4 MB)</label>
        <input id={`img-${slot}`} name="image" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-1 block w-full text-sm text-mute file:mr-3 file:min-h-10 file:rounded-sm file:border file:border-ink-600 file:bg-ink-850 file:px-3 file:text-bone" />
      </div>
      <TextField label="Texto alternativo" name="alt" maxLength={200} hint="Descreva a imagem para leitores de tela." />
    </ActionForm>
  );
}
