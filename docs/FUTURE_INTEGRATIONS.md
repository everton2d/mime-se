# Mime-se — Plano de Futuras Integrações
> Gerado em: 2026-06-08

## Prioridade Alta (próximos 3 meses)

### 1. Hotmart + Eduzz + Monetizze
**O que:** Importar produtos da própria conta do afiliado automaticamente.  
**Como:** OAuth2 para cada plataforma → listar produtos aprovados → gerar links rastreados em lote.  
**Valor:** Elimina o trabalho manual de copiar URLs; afiliados de infoprodutos são o maior segmento brasileiro.  
**Tabela nova:** `imported_products(id, user_id, platform, product_id, name, commission_pct, url)`

### 2. Notificações Push (Web Push API)
**O que:** Alertar afiliado quando uma oferta flash é capturada.  
**Como:** Service Worker + Push API (VAPID keys no backend) → trigger no insert de `captured_offers`.  
**Valor:** Velocidade de resposta em promoções relâmpago é crítica para conversão.

### 3. Encurtador de Links Próprio
**O que:** Domínio `ms.link/xyz` em vez de links longos de afiliado.  
**Como:** Edge Function de redirect com contagem de cliques → tabela `link_events` já existe.  
**Valor:** Links mais limpos para WhatsApp/Instagram; tracking real de CTR.

### 4. Relatório Semanal por E-mail
**O que:** Resumo automático: cliques, receita estimada, melhores ofertas da semana.  
**Como:** n8n cron semanal → busca dados Supabase → formata HTML → envia via Resend API.  
**Valor:** Retém usuários que não acessam o dashboard todo dia.

---

## Prioridade Média (3–6 meses)

### 5. Instagram Direct Automation
**O que:** Resposta automática a comentários/DMs com link de afiliado.  
**Como:** Instagram Graph API (Business account) + webhook → n8n → resposta com link.  
**Complexidade:** Alta (política do Instagram é restritiva; precisa aprovação da app).

### 6. Pixel de Conversão
**O que:** Rastrear quando um clique vira venda.  
**Como:** Postback URL configurável por plataforma (Amazon, Hotmart, etc.) → salva em `link_events(type='conversion')`.  
**Valor:** Score de Oferta e Ranking Inteligente ficam muito mais precisos com dados reais de conversão.

### 7. A/B Test de Textos
**O que:** Testar 2 versões do mesmo texto de oferta e ver qual converte mais.  
**Como:** Ao publicar, envia versão A para 50% do grupo e versão B para os outros 50% → compara CTR em 24h.  
**Tabela nova:** `ab_tests(id, user_id, offer_id, text_a, text_b, clicks_a, clicks_b, winner)`

### 8. Integração Mercado Livre Seller
**O que:** Afiliados que também vendem no ML podem ver estoque e ajustar ofertas.  
**Como:** ML OAuth2 → listar anúncios → sync com `captured_offers`.

### 9. WhatsApp Business Cloud API (Meta oficial)
**O que:** Substituir Evolution API (não oficial) pela API oficial da Meta.  
**Valor:** Maior confiabilidade, sem risco de ban; necessário para escalar.  
**Como:** Webhook Meta → n8n → tabela `disparos` existente.

---

## Prioridade Baixa / Visão de Longo Prazo (6–12 meses)

### 10. App Mobile (PWA → React Native)
**O que:** PWA primeiro (manifest + service worker) → depois React Native com Expo.  
**Valor:** Afiliados operam pelo celular; notificações push nativas.

### 11. Marketplace de Templates
**O que:** Afiliados podem publicar e comprar templates de outros usuários.  
**Como:** `content_templates` já existe; adicionar `is_public, price_credits, author_id`.  
**Modelo:** Sistema de créditos (sem pagamento real inicialmente).

### 12. IA Preditiva de Tendências
**O que:** Prever quais categorias/produtos vão ter pico de vendas (sazonalidade + trends Google).  
**Como:** Google Trends API + histórico de `captured_offers` → modelo de classificação simples.

### 13. Multi-idioma
**O que:** Suporte a PT-BR, EN, ES para expansão para afiliados de outros países.  
**Como:** i18n simples com objeto de strings; Supabase já suporta multi-tenant por design.

### 14. Dashboard Analítico para Agências
**O que:** Visão consolidada de múltiplos clientes num único painel.  
**Como:** Nova role `agency` → tabela `agency_members` → views agregadas por agência.

---

## Integrações Técnicas de Suporte

| Serviço | Finalidade | Status |
|---------|-----------|--------|
| Resend | E-mails transacionais e relatórios | Pendente |
| Sentry | Monitoramento de erros frontend | Pendente |
| PostHog | Product analytics (funnels, retenção) | Pendente |
| Cloudflare Images | CDN para imagens de ofertas | Pendente |
| Upstash Redis | Rate limiting nas Edge Functions | Pendente |
| Stripe | Billing e planos pagos | Pendente |
