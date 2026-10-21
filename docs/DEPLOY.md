# Publicação na Vercel

> Uso comercial exige o plano **Pro** da Vercel (o Hobby é restrito a uso pessoal/não comercial). Veja [CUSTOS.md](CUSTOS.md).

## 1. Repositório
Envie este projeto para um repositório Git (GitHub/GitLab/Bitbucket). O `.gitignore` já exclui `.env*` (exceto `.env.example`) e `.data/`.

## 2. Banco de dados (Neon)
1. Na Vercel: **Storage → Create → Neon (Postgres)** e conecte ao projeto — isso cria `DATABASE_URL` (com pooler) e `DATABASE_URL_UNPOOLED` automaticamente. Alternativa: criar o projeto direto em neon.com e copiar as duas URLs.
2. Região: escolha a mesma região das funções da Vercel (ex.: `sa-east-1`/São Paulo, se disponível no seu plano, ou `us-east-1`).
3. Recomendado: integração Neon ↔ Vercel com **branch por preview**, para que deploys de preview não usem o banco de produção.

## 3. Armazenamento de imagens (Vercel Blob)
1. **Storage → Create → Blob** com acesso **Public** → conecte ao projeto (gera `BLOB_READ_WRITE_TOKEN`).
2. Crie um segundo store com acesso **Private** e copie o token para a variável `BLOB_PRIVATE_READ_WRITE_TOKEN` (renomeie se a Vercel sugerir outro nome).

## 4. Variáveis de ambiente (Settings → Environment Variables, ambiente *Production*)
| Variável | Valor |
| --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Criadas pela integração Neon |
| `AUTH_SECRET` | `openssl rand -hex 32` |
| `APP_URL` | `https://seu-dominio` (sem barra no final) |
| `BLOB_READ_WRITE_TOKEN`, `BLOB_PRIVATE_READ_WRITE_TOKEN` | Tokens dos dois stores |
| `CRON_SECRET` | `openssl rand -hex 24` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Opcionais (ver passo 7) |

## 5. Deploy
O `vercel.json` define `buildCommand: npm run build:vercel`, que **aplica as migrações somente em produção** (`VERCEL_ENV=production`) e depois executa `next build`. O build lê o banco para pré-renderizar as páginas públicas — o banco precisa estar acessível durante o build.

## 6. Primeiro administrador
No seu computador, com a URL **direta** do banco de produção:
```bash
DATABASE_URL="<DATABASE_URL_UNPOOLED de produção>" npm run admin:create
```
Acesse `https://seu-dominio/admin/login` e siga a lista "Configuração inicial" do painel (nome, horários, serviços, contatos, fotos reais).

## 7. E-mail (opcional, recomendado)
1. Crie conta no Resend, adicione e **verifique o domínio** (registros DNS SPF/DKIM).
2. Defina `RESEND_API_KEY` e `EMAIL_FROM` (ex.: `Estúdio <contato@seudominio.com.br>`) e faça novo deploy.
3. Teste: faça uma solicitação pelo site com seu e-mail e verifique em **/admin/notificacoes** o status "Enviado".
Sem essas variáveis, nada é enviado automaticamente — as mensagens aparecem no painel para envio manual.

## 8. Domínio
**Settings → Domains → Add**: informe o domínio e configure no seu registrador o registro indicado pela Vercel (A/ALIAS no domínio raiz ou CNAME em `www`). O certificado HTTPS é emitido automaticamente. Depois, atualize `APP_URL` e faça novo deploy.

## 9. Rotina diária
O `vercel.json` agenda `/api/cron/daily` às 12:00 UTC (09:00 em Brasília). A Vercel envia `Authorization: Bearer $CRON_SECRET`. Teste manual:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://seu-dominio/api/cron/daily
```

## 10. Verificação pós-deploy
- [ ] Página inicial, portfólio e `/sitemap.xml` carregam
- [ ] `/admin` redireciona para login; login funciona
- [ ] Criar serviço e horário → `/agendar` mostra horários
- [ ] Fazer uma solicitação de teste, confirmar no painel e cancelá-la
- [ ] Enviar imagem no portfólio e publicá-la
- [ ] Excluir os dados de teste (cliente → "Excluir dados")
