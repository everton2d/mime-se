# Mime-se — Relatório de Arquitetura
> Gerado em: 2026-06-08

## Visão Geral

Mime-se é uma plataforma SaaS de produtividade para afiliados brasileiros. Arquitetura serverless com frontend HTML/CSS/JS puro e backend Supabase (PostgreSQL + Auth + Edge Functions).

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS (ES2022) |
| Auth | Supabase Auth (email/senha + Google OAuth) |
| Banco | Supabase PostgreSQL (Row Level Security) |
| Functions | Supabase Edge Functions (Deno/TypeScript) |
| IA | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) |
| Automação | n8n (4 workflows) |
| Deploy | Vercel (auto-deploy via GitHub push) |
| WhatsApp | Evolution API (REST) |

---

## Estrutura de Arquivos

```
mime-se/
├── index.html              # SPA principal — todas as páginas em divs .page
├── css/
│   ├── style.css           # Landing page, auth, tema claro/escuro
│   └── dashboard.css       # Dashboard e todos os subcomponentes
├── js/
│   ├── main.js             # Auth, routing de páginas, theme toggle
│   └── dashboard.js        # Toda lógica do dashboard (loaders, helpers, etc.)
├── supabase/
│   └── functions/
│       ├── generate-affiliate-link/   # Geração de links rastreados
│       └── generate-ai-content/       # 7 ferramentas de IA para afiliados
└── docs/
    ├── ARCHITECTURE.md     # Este arquivo
    └── FUTURE_INTEGRATIONS.md
```

---

## Banco de Dados — Tabelas

| Tabela | Finalidade | RLS |
|--------|-----------|-----|
| `profiles` | Dados do usuário (nome, plano) | user_id = auth.uid() |
| `links` | Links de afiliado gerados | user_id = auth.uid() |
| `link_events` | Eventos de clique por link | via link.user_id |
| `grupos` | Grupos Telegram do usuário | user_id = auth.uid() |
| `disparos` | Histórico de envios | user_id = auth.uid() |
| `leads` | Leads capturados | user_id = auth.uid() |
| `configuracoes` | Config global por usuário | user_id = auth.uid() |
| `marketplace_configs` | Credenciais Amazon/Mercado Livre/etc | user_id = auth.uid() |
| `template_stories` | Templates de stories | user_id = auth.uid() |
| `texto_disparo` | Templates de texto | user_id = auth.uid() |
| `captured_offers` | Ofertas capturadas via Telegram | user_id = auth.uid() |
| `automation_configs` | ON/OFF de cada automação | user_id = auth.uid() |
| `content_calendar` | Calendário de conteúdo | user_id = auth.uid() |
| `content_templates` | Templates personalizados | user_id = auth.uid() |

---

## Roteamento SPA

### Páginas públicas (`main.js → showPage()`)
- `home` → Landing page
- `login` → Formulário de login
- `register` → Formulário de cadastro
- `dashboard` → Entra no SPA do dashboard

### Subpáginas do dashboard (`dashboard.js → showDashPage()`)
Cada subpágina corresponde a um `<div id="dp-{name}">` no HTML e uma função `loadPage{Name}()` no JS.

| Rota | Loader | Seção Sidebar |
|------|--------|---------------|
| `painel` | `loadPainel` | Principal |
| `links` | `loadPageLinks` | Principal |
| `ia-conversao` | `loadPageIaConversao` | IA & Criação |
| `templates` | `loadPageTemplates` | IA & Criação |
| `calendario` | `loadPageCalendario` | IA & Criação |
| `metricas` | `loadPageMetricas` | Análise |
| `ranking` | `loadPageRanking` | Análise |
| `automacoes` | `loadPageAutomacoes` | Automação |
| `capturas` | `loadPageCapturas` | Automação |
| `grupos` | `loadPageGrupos` | Conta |
| `leads` | `loadPageLeads` | Conta |
| `disparo` | `loadPageDisparo` | Conta |
| `stories` | `loadPageStories` | Conta |
| `config` | `loadPageConfig` | Conta |
| `lojas` | `loadPageLojas` | Conta |

---

## Edge Functions

### `generate-affiliate-link`
- **Método:** POST
- **Auth:** JWT obrigatório (verify_jwt: true)
- **Input:** `{ platform, product_url, product_id?, custom_tag? }`
- **Output:** `{ affiliate_url, short_url, tracking_id }`
- **Lógica:** Lê `marketplace_configs` do usuário, aplica parâmetros de rastreamento conforme plataforma

### `generate-ai-content`
- **Método:** POST
- **Auth:** JWT obrigatório (verify_jwt: true)
- **Env:** `ANTHROPIC_API_KEY`
- **Input:** `{ tool: string, context: { title, price, platform, description } }`
- **Output:** `{ result: string, tool: string }`
- **Ferramentas disponíveis:**
  - `whatsapp` — Texto persuasivo para WhatsApp
  - `telegram` — Post formatado para Telegram
  - `story` — Roteiro de story 15s
  - `legenda` — Legenda Instagram com hashtags
  - `reels` — Roteiro de Reels 30-60s
  - `titulo` — Título persuasivo com gatilhos
  - `cta` — 5 variações de CTA

---

## Fluxos n8n

| ID | Nome | Trigger | Saída |
|----|------|---------|-------|
| `ojk5zEcumjMLtODx` | Captura Telegram | Telegram Bot (mensagem) | Salva em `captured_offers` |
| `BIZWsZBcAO3dO45e` | Reescrita com IA | Webhook (oferta aprovada) | Texto reescrito via Claude |
| `0MHEjmAPCEnHn66w` | Publicar no Telegram | Webhook (oferta pronta) | Publica no grupo Telegram |
| `5bip2bnck11ow27p` | Publicar no WhatsApp | Webhook (oferta pronta) | Publica via Evolution API |

---

## Score de Oferta — Algoritmo

```
score = 0
+ até 3.0 pts — desconto % (>50% = 3.0, >30% = 2.0, >10% = 1.0)
+ até 2.0 pts — confiança da plataforma (Amazon=2.0, Mercado Livre=1.5, etc.)
+ até 2.0 pts — keywords de urgência (frete grátis, cupom, flash, prime, etc.)
+ até 1.5 pts — faixa de preço ideal (R$20–500 = 1.5, R$10–1000 = 1.0)
+ até 1.5 pts — tem imagem + descrição completa

score normalizado 0–10 → badge: Excelente(≥8), Boa(≥6), Regular(≥4), Ruim(<4)
```

---

## Segurança

- RLS em todas as tabelas — usuários só veem seus próprios dados
- JWT validado em todas as Edge Functions
- `escapeHtml()` aplicado em todo `innerHTML` dinâmico (prevenção XSS)
- Chaves de API armazenadas como Supabase Secrets (nunca no frontend)
- Auto-logout por inatividade de 30 minutos
