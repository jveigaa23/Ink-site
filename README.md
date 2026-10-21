# Plataforma do estúdio de tatuagem

Site público premium (portfólio, estúdio, serviços, orçamento e **agendamento com disponibilidade real**) e painel administrativo próprio (agenda, orçamentos, clientes, portfólio, serviços, notificações e configurações), sobre um único banco PostgreSQL.

> O nome comercial, contatos, textos e cores ficam **todos no painel** (`/admin/configuracoes`), com padrões neutros em [`src/config/settings-schema.ts`](src/config/settings-schema.ts). Nenhuma informação do estúdio foi inventada: campos vazios simplesmente não aparecem no site.

## Stack

| Camada | Escolha |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components, Server Actions), React 19, TypeScript estrito |
| Estilo | Tailwind CSS v4 com design tokens em [`src/app/globals.css`](src/app/globals.css) |
| Banco | PostgreSQL (Neon em produção) via Drizzle ORM + migrações SQL versionadas em [`drizzle/`](drizzle) |
| Imagens | Vercel Blob (store público + store privado), processadas com `sharp` |
| E-mail | Resend (API HTTP), opcional — sem ele, envio manual pelo painel |
| Validação | Zod (mesmos esquemas no navegador e no servidor) |
| Testes | Vitest (unitários + integração com PostgreSQL real) e Playwright (E2E) |

Detalhes: [docs/ARQUITETURA.md](docs/ARQUITETURA.md) · Publicação: [docs/DEPLOY.md](docs/DEPLOY.md) · Custos: [docs/CUSTOS.md](docs/CUSTOS.md) · Operação, backup e LGPD: [docs/OPERACAO.md](docs/OPERACAO.md)

## Executar localmente

Pré-requisitos: Node.js ≥ 20.9 e PostgreSQL ≥ 14 (com a extensão `btree_gist`, padrão no PostgreSQL).

```bash
npm install
cp .env.example .env.local          # preencha DATABASE_URL e AUTH_SECRET
npm run db:migrate                  # cria as tabelas e a restrição anti-conflito
npm run admin:create                # cria o primeiro administrador (pergunta e-mail, nome e senha)
npm run db:seed:demo                # OPCIONAL: serviços, horários e imagens DEMONSTRATIVAS
npm run dev                         # http://localhost:3000  ·  painel em /admin
```

Sem tokens do Vercel Blob, em desenvolvimento as imagens são gravadas em `.data/uploads` (nunca em produção).

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` / `build` / `start` | Desenvolvimento, build e servidor de produção |
| `npm run lint` · `typecheck` | ESLint e TypeScript |
| `npm test` | Testes unitários e de integração (usa `TEST_DATABASE_URL`, recriado a cada execução) |
| `npm run test:e2e` | Playwright: sobe um build isolado contra `E2E_DATABASE_URL` |
| `npm run check` | lint + typecheck + testes + build |
| `npm run db:generate` | Gera nova migração a partir de `src/db/schema.ts` |
| `npm run db:migrate` | Aplica migrações pendentes |
| `npm run admin:create` | Cria administrador (interativo; ou `ADMIN_EMAIL`/`ADMIN_NAME`/`ADMIN_PASSWORD`) |
| `npm run admin:reset-password` | Redefine a senha de um administrador e encerra as sessões dele |
| `npm run db:seed:demo` | Dados demonstrativos (bloqueado em produção) |

## Primeiro administrador (seguro)

Não existe senha padrão nem cadastro público de administradores. O primeiro acesso é criado **pela linha de comando**, apontando para o banco desejado:

```bash
DATABASE_URL="<url do banco de produção>" npm run admin:create
```

A senha precisa ter 12+ caracteres e três tipos de caractere; é guardada com scrypt. Para recuperar acesso: `npm run admin:reset-password` (requer acesso ao banco — a recuperação por e-mail depende do provedor de e-mail e não está implementada).

## Estrutura

```
src/
  app/(site)/        páginas públicas          app/admin/       painel (login + (panel))
  app/actions/       Server Actions públicas    app/admin/_actions/  Server Actions do painel
  app/api/           disponibilidade, cron, referências privadas
  components/        ui/ (primitivas), site/, booking/, forms/, admin/
  config/            configurações editáveis + padrões (fonte única da marca)
  db/                schema Drizzle e conexão
  domain/            regras puras: disponibilidade e máquinas de status
  lib/               fuso horário, validação, criptografia, utilitários
  server/            serviços (agenda, orçamentos, portfólio, clientes, auth, notificações, armazenamento)
drizzle/             migrações SQL versionadas
tests/               unit/, integration/, e2e/
```
