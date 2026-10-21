# Arquitetura

## Visão geral

```
Navegador ──► Next.js (Vercel Functions)
              ├─ Páginas públicas: pré-renderizadas + cache por tag ("use cache")
              │     └─ invalidadas pelo painel com updateTag() após cada alteração
              ├─ Disponibilidade (/api/availability): sempre por requisição, sem cache
              ├─ Server Actions: orçamento, reserva, confirmação, painel (todas validadas no servidor)
              └─ Painel /admin: sempre por requisição, sessão verificada em cada página e ação
                    │
                    ├─► PostgreSQL (Neon) — fonte única de dados
                    ├─► Vercel Blob público (portfólio/site)  ·  Vercel Blob privado (referências)
                    └─► Resend (e-mail), opcional
Vercel Cron (1x/dia) ─► /api/cron/daily: expira reservas, lembretes, reenvios, retenção LGPD
```

Camadas: `src/domain` (regras puras e testáveis) → `src/server` (serviços com acesso a dados, recebem `db` por parâmetro) → `src/app` (rotas, Server Actions e componentes). As Server Actions só validam entrada, verificam permissão e chamam os serviços.

## Modelo de dados (resumo)

| Tabela | Uso |
| --- | --- |
| `admin_users`, `admin_sessions` | Administradores (papel `owner`/`staff`, pronto para expansão) e sessões (somente hash do token) |
| `settings` | Configurações em JSON validadas por Zod: `studio`, `booking`, `notifications`, `privacy` |
| `services`, `business_hours`, `availability_blocks` | Catálogo, expediente semanal (vários intervalos/dia) e bloqueios |
| `clients` | Contato mínimo + consentimento; anonimização por pedido ou retenção |
| `quote_requests`, `quote_references` | Orçamentos (protocolo + hash do token de acompanhamento) e referências privadas |
| `appointments` | Agendamentos; cadeia de reagendamentos via `root_id` / `rescheduled_from_id` |
| `portfolio_items`, `portfolio_categories` | Portfólio (publicado/rascunho, destaque, demonstrativo, ordem) |
| `notifications` | Outbox de mensagens com chave de idempotência |
| `audit_log` | Histórico de alterações relevantes (sem dados pessoais desnecessários) |
| `rate_limits` | Limitação de requisições persistida (funciona entre instâncias serverless) |

Datas são `timestamptz` (UTC). A conversão para o fuso do estúdio (`settings.booking.timezone`, padrão `America/Sao_Paulo`) é sempre explícita (`src/lib/time.ts`, testada inclusive com horário de verão).

## Agendamento e prevenção de conflitos

1. O cliente vê apenas horários calculados pelo servidor (`src/domain/availability.ts`): expediente, duração do serviço, intervalo de preparo, bloqueios, antecedência mínima e horizonte.
2. Ao escolher um horário, o servidor cria uma **reserva temporária** (`held`) com expiração no servidor (`holdMinutes`). O cronômetro do navegador é apenas informativo.
3. Ao enviar os dados, o servidor **revalida** o horário dentro da transação e grava como `pending` (ou `confirmed`, se a confirmação automática estiver ativa).
4. Garantias contra conflito, em camadas:
   - `pg_advisory_xact_lock` serializa as alterações de agenda;
   - revalidação com a mesma função de disponibilidade dentro da transação;
   - **restrição de exclusão no banco** (`EXCLUDE USING gist (tstzrange(starts_at, blocked_until) WITH &&)` para status ativos) — impede sobreposição mesmo que a aplicação falhe. Testado com 8 reservas simultâneas: só uma é aceita.
5. Status distintos e explícitos: `held` (reserva temporária), `pending` (solicitação recebida), `confirmed`, `cancelled`, `completed`, `no_show`, `expired`.
6. O cliente acompanha, cancela ou remarca **somente** pelo link secreto (token de 256 bits; apenas o hash é salvo). Conhecer o protocolo ou o ID não dá acesso a alterações. A consulta por protocolo exige também o contato e é somente leitura.

## Segurança

- Sessão administrativa: cookie `__Host-` httpOnly, Secure, SameSite=Lax; token aleatório, hash SHA-256 no banco; expiração deslizante de 7 dias; logout revoga; troca de senha revoga as demais sessões.
- Senhas: scrypt (N=2¹⁵), mínimo de 12 caracteres; tempo de resposta equalizado e mensagem genérica (sem enumeração de contas).
- Limites de tentativa (PostgreSQL): login por IP e por e-mail, orçamentos, reservas, confirmações, consultas e alterações de cliente.
- CSRF: Server Actions verificam a origem (Next.js) e o cookie é SameSite=Lax; formulários públicos não dependem de cookies.
- Autorização sempre no servidor (`requireAdmin()` em cada página, ação e rota do painel).
- Entradas validadas com Zod; consultas parametrizadas (Drizzle); textos exibidos sem HTML (sem `dangerouslySetInnerHTML`, exceto JSON-LD escapado).
- Uploads: tipo verificado pelo conteúdo (sharp), limite de 4 MB e 40 MP, reencodados em WebP, **metadados EXIF/GPS removidos**, nomes aleatórios. Referências de clientes ficam em store privado, servidas apenas por rota autenticada (`/api/admin/references/[id]`), nunca publicadas automaticamente.
- Antispam: campo isca, tempo mínimo de preenchimento e limitação por IP (IP guardado apenas como hash com segredo).
- Cabeçalhos: `X-Frame-Options`, `frame-ancestors`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `noindex` e `no-store` no painel; `no-referrer` nas páginas de acompanhamento.
- Segredos só em variáveis de ambiente do servidor; nenhum segredo chega ao navegador.

## Cache

Conteúdo público (configurações, serviços, horários, portfólio publicado) usa `"use cache"` com `cacheTag` e `cacheLife("hours")`; o painel chama `updateTag()` após cada alteração. Disponibilidade, acompanhamento e painel **nunca** são cacheados.

## Decisões e alternativas

- **Next.js + Vercel + Neon**: menor complexidade operacional, PostgreSQL padrão (sem lock-in de API), escala a zero.
- **Drizzle + SQL versionado**: migrações legíveis e a restrição de exclusão em SQL puro.
- **Autenticação própria simples** (administrador único com papéis prontos) em vez de provedor externo: sem custo, sem dependência, sessões revogáveis. Recuperação de senha por e-mail fica para quando houver provedor configurado.
- **Pagamentos não integrados por padrão** (requisito). O sinal é configurável como aviso e registrado manualmente. Integração futura sugerida: Mercado Pago ou Stripe com Checkout hospedado + webhook assinado confirmando o pagamento (nunca armazenar cartão; nunca marcar como pago sem webhook).
- **WhatsApp**: sem integração automática (a API oficial do WhatsApp Business tem custo por conversa e exige aprovação de templates). O painel gera links "click to chat" com a mensagem pronta para envio manual.
