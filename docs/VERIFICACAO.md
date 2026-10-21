# Verificação (resultados reais — outubro/2026, ambiente local)

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Lint | `npm run lint` | ✅ sem erros nem avisos |
| Tipos (strict) | `npm run typecheck` | ✅ sem erros |
| Unitários + integração (PostgreSQL 16 real) | `npm test` | ✅ 50/50 (6 arquivos) |
| Build de produção | `npm run build` | ✅ 37 rotas; públicas estáticas com revalidação por tag |
| E2E (Playwright, Chromium, banco isolado) | `npm run test:e2e` | ✅ 9/9 (desktop + celular) |
| Acessibilidade automática (axe-core, WCAG 2.2 AA) | páginas públicas e painel | ✅ 0 violações após correções |
| Lighthouse (mobile simulado, build local) | `/`, `/portfolio`, `/agendar` | Desempenho 89 / 92 / 94 · Acessibilidade 100 · SEO 100 · Boas práticas 96–100¹ |

¹ Os 96 se devem apenas às imagens demonstrativas gravadas em disco local, que o servidor de produção não serve; na Vercel as imagens vêm do Blob.

## Cobertura dos testes
- **Unitários:** cálculo de disponibilidade (expediente, duração, preparo, bloqueios, antecedência, horizonte, pausas), fusos e horário de verão, transições de status, políticas de cancelamento, validação de formulários e configurações (inclusive cor e URLs perigosas), protocolos, senhas, valores.
- **Integração:** reserva e confirmação, idempotência, **8 reservas simultâneas no mesmo horário → só 1 aceita**, restrição do banco contra inserção direta sobreposta, expiração de reservas no servidor, confirmação tardia, limite de reservas por IP, horários inválidos, bloqueio criado durante a reserva, cancelamento e reagendamento (com e sem aprovação), proteção contra alterar agendamento de terceiros, operações administrativas, notificações sem provedor (pendência manual, sem simular envio) e com falha do provedor (registrada, sem desfazer a solicitação, link secreto não persistido), uploads (tipo real, EXIF removido, armazenamento privado), conversão de orçamento, anonimização LGPD, login, sessões, força bruta, portfólio (publicação, troca e exclusão de arquivos).
- **E2E:** navegação pública, 404, SEO, orçamento com validação e referência, agendamento com horários reais (horário reservado deixa de ser oferecido), link inválido, bloqueio de acesso não autorizado (páginas, rota de referências e cron), login inválido, confirmação de agendamento com histórico, pendência de notificação manual, atualização de orçamento, criação/publicação/despublicação no portfólio refletindo no site, logout, uso em celular (menu, sem rolagem horizontal, alvos de toque ≥ 44 px).

## Problemas encontrados e corrigidos durante a verificação
- `Date` cru em SQL não era serializado (anonimização) — trocado por operadores tipados.
- Validação de sessão usava o relógio durante pré-renderização em tempo de execução (Partial Prefetching) — sessão agora sempre por requisição (`connection()`).
- Funções passadas de componentes de servidor para cliente (render-props) — erros de campo agora via contexto.
- Arquivos escolhidos antes da hidratação eram descartados no envio — leitura direta do campo.
- Animação de revelação reduzia contraste; token `--faint` abaixo de 4,5:1 em superfícies; nome acessível do botão de ampliar.
- Textura de grão com filtro SVG custava ~3,7 s de pintura no celular — substituída por WebP de 7,5 KB (TBT 1.590 ms → 280 ms).

## Não verificado neste ambiente
- Deploy real na Vercel, Neon, Vercel Blob e Resend (dependem de contas/credenciais do proprietário).
- Envio real de e-mails (sem `RESEND_API_KEY`).
- Navegadores Safari/Firefox e dispositivos físicos (testado em Chromium desktop e emulação Pixel 7).
- LCP no celular simulado ficou em 2,5–3,0 s (meta “bom”: ≤ 2,5 s); reavaliar com fotos reais e CDN da Vercel.



> Deploy automático via Git ativo (testado em outubro/2026).
