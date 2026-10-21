# Operação, backup e privacidade

## Rotina diária automática (`/api/cron/daily`)
Expira reservas temporárias vencidas · envia lembretes de sessões confirmadas (sem duplicar) · reenvia e-mails com falha (até 3 tentativas) · exclui orçamentos recusados/arquivados após o prazo de retenção · anonimiza clientes inativos após o prazo configurado · limpa sessões expiradas e contadores antigos.

## Backup e recuperação
- **Banco (Neon):** o Neon mantém histórico para restauração pontual (janela depende do plano: curta no Free, maior nos pagos). Restaurar: painel Neon → *Branches* → *Restore* para um instante anterior (ou criar branch a partir do ponto e apontar `DATABASE_URL`).
- **Cópia lógica periódica (recomendado):** `pg_dump "$DATABASE_URL_UNPOOLED" -Fc -f backup-$(date +%F).dump` semanalmente, guardado fora da Vercel/Neon. Restaurar: `pg_restore -d <url> --clean backup.dump`.
- **Imagens (Vercel Blob):** não há versionamento automático. Mantenha os originais das fotos do portfólio. Se necessário, um job pode copiar os blobs para outro armazenamento (exemplo oficial da Vercel com S3).

## Manutenção
- Atualizações: `npm outdated`; atualize em branch, rode `npm run check` e `npm run test:e2e` antes de publicar.
- Nova coluna/tabela: altere `src/db/schema.ts` → `npm run db:generate` → revise o SQL em `drizzle/` → commit. O deploy de produção aplica.
- Logs: Vercel → Project → Logs. Erros não incluem dados pessoais nem tokens.
- Acesso perdido: `npm run admin:reset-password` com a URL do banco.

## Privacidade (LGPD)
O sistema foi construído com práticas de minimização e controle, mas **não constitui certificação de conformidade** — recomenda-se revisão do aviso de privacidade por profissional jurídico.
- Coleta mínima (nome + e-mail ou telefone); consentimento registrado com data.
- Aviso de privacidade em `/privacidade` (texto em `src/app/(site)/privacidade/page.tsx`; contato do encarregado configurável).
- Acesso restrito a administradores autenticados; sem exportação em massa; referências em armazenamento privado.
- **Pedido de exclusão:** Painel → Clientes → cliente → "Excluir dados (LGPD)" (remove contatos, textos e referências; mantém apenas registros de agenda anônimos).
- Retenção configurável (Configurações → Notificações e privacidade).
- Operadores de dados: Vercel (hospedagem/arquivos), Neon (banco), Resend (e-mail, se ativado) — avalie os termos de tratamento (DPA) de cada um e a transferência internacional de dados.
- Sem cookies de rastreamento no site público; apenas cookie essencial de sessão no painel — por isso não há banner de cookies.
