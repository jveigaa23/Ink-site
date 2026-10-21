# Custos e limites (verificados em outubro/2026)

## Cenário atual: demonstração "Ink Site" (uso pessoal, não comercial)
Projeto de demonstração na Vercel no plano **Hobby** (gratuito), somente para uso pessoal e não comercial, com dados demonstrativos. Custo: US$ 0 nos serviços abaixo, dentro dos limites gratuitos. Não divulgue a demo como site de um estúdio real nem a use para atender clientes.

## Cenário futuro: site do estúdio real
Requer o plano **Pro** da Vercel (uso comercial) e os demais serviços da tabela abaixo.


> Preços mudam. Confirme nas páginas oficiais antes de contratar. Valores em USD.

| Serviço | Plano sugerido | Custo | Limites relevantes | Ao atingir o limite |
| --- | --- | --- | --- | --- |
| **Vercel** | **Pro** (obrigatório para uso comercial) | US$ 20/mês por membro com assento | Inclui crédito de uso mensal e cotas de transferência/requisições; acima disso cobrança sob demanda | Cobrança de excedente — **ative o Spend Management** com limite |
| Vercel Hobby | — | Grátis | **Somente uso pessoal/não comercial** | Não usar para o estúdio |
| **Neon** (PostgreSQL) | Free para começar | US$ 0 | 0,5 GB de armazenamento, 100 CU-horas/mês, 5 GB de transferência, escala a zero após 5 min | Computação **suspensa até o próximo mês** (site sem banco) |
| Neon Launch | Quando crescer | Por uso: ~US$ 0,106/CU-hora e US$ 0,35/GB-mês, sem mínimo | Backups/restauração com janela maior | Cobrança por uso |
| **Vercel Blob** | Incluído no Pro com cota | **Pendente de confirmação** | Armazenamento e transferência cobrados por uso acima da cota | Confirmar em vercel.com/docs/vercel-blob/usage-and-pricing |
| **Resend** (e-mail) | Free | US$ 0 | 3.000 e-mails/mês, **100/dia**, 1 domínio | Envio bloqueado no dia; o painel registra a falha e a rotina diária tenta novamente |
| Domínio `.com.br` | Registro.br | **Pendente de confirmação** (anual) | — | — |
| WhatsApp | Envio manual (links do painel) | US$ 0 | — | — |

## Estimativa para um estúdio pequeno
- **Início:** Vercel Pro (US$ 20/mês) + Neon Free + Blob dentro da cota + Resend Free + domínio ≈ **US$ 20/mês + domínio anual**.
- O volume de um estúdio (dezenas de solicitações por mês, algumas centenas de imagens otimizadas em WebP) cabe nos planos gratuitos de banco e e-mail.

## Riscos de cobrança inesperada e mitigação
- Vercel: configure **Spend Management** (alerta e limite) no Pro.
- Neon Free não cobra, mas **suspende** ao atingir a cota — acompanhe o uso; migrar para Launch é sem mínimo mensal.
- Otimização de imagens da Vercel é cobrada por uso: as imagens já são reduzidas no upload (WebP, máx. 2400 px) e têm cache de 31 dias.
- Resend Free: 100 e-mails/dia. Se o volume crescer, o plano pago remove o limite diário.

## Por que não incluir agora
- **Pagamentos** (Mercado Pago/Stripe): taxas por transação, webhooks e conformidade — só quando o estúdio decidir cobrar sinal online.
- **API oficial do WhatsApp**: custo por conversa e aprovação de modelos — o envio manual cobre o volume atual.
- **Monitoramento pago**: os logs da Vercel e o painel de notificações bastam no início.

Fontes: [Vercel — plano Hobby](https://vercel.com/docs/plans/hobby) · [Vercel pricing](https://vercel.com/pricing) · [Neon pricing](https://neon.com/pricing) · [Resend pricing](https://resend.com/pricing)
