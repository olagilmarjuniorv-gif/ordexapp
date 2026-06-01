
# Módulo CONFIGURAÇÕES — Análise de Schema e Plano

## 1. Análise do schema atual

### Tabela `companies` (já existe, parcial)
**Campos já existentes:**
- Identidade: `id, name, slug, active, created_at, updated_at`
- Contato: `phone, whatsapp, email`
- Endereço: `cep, rua, numero, complemento, bairro, cidade, estado`
- Operação: `delivery_ativo, retirada_ativa, tempo_preparo_min, pedido_minimo, taxa_entrega`
- Horários: `horarios` (jsonb por dia da semana — já cobre Aba 2)
- Pagamentos: `pagamento_metodos` (jsonb), `exigir_pagamento_antes_cozinha`, `permitir_pagamento_entrega`, `permitir_pagamento_retirada`

**Campos FALTANTES em `companies`:**
- Fiscal/empresa: `razao_social`, `cnpj`, `inscricao_estadual`
- E-mails segmentados: `email_financeiro`, `email_operacional`
- Responsável: `responsavel_nome`, `responsavel_cpf`, `responsavel_telefone`
- Público (vitrine): `nome_publico`, `telefone_publico`, `endereco_publico`
- Operação extra: `tempo_entrega_min`, `raio_entrega_km`
- Canais habilitados (Aba 2): `canais_ativos` jsonb `{whatsapp,balcao,mesa,delivery,ifood:boolean}`
- Mensagens operacionais (Aba 2): `mensagens_operacionais` jsonb `{loja_fechada, recebido, preparo, pronto, finalizado}`
- Chatbot (Aba 6): `chatbot_saudacao`, `chatbot_encerramento`, `chatbot_transferencia_humano`
  - (já existe `whatsapp_fluxos` com 3 mensagens semelhantes — vamos REUTILIZAR, não duplicar)

### Tabela `whatsapp_conexoes` (já cobre Aba 3 — leitura)
Tem: `phone_number, phone_number_id, whatsapp_business_id, status, connected_at, last_sync_at, last_error, settings (jsonb)`
- Recursos (bot/humano/auto-status) → guardar em `settings` jsonb (sem migration de coluna)
- Indicadores de conversas/mês/qualidade → **somente UI placeholder** (Meta API não plugada ainda)

### Tabela `whatsapp_fluxos` (já cobre Aba 6)
Já tem: `mensagem_boas_vindas, mensagem_fechamento, mensagem_sem_atendimento, ativo`
→ Mapeia 1:1 com Aba 6. **Sem migration**.

### Tabela `integracoes` (já cobre estrutura de gateways de pagamento — Aba 4)
Tem: `provider, status, settings, active...` → suporta `asaas`, `mercado_pago` como novos `provider`. **Sem migration nova**, só UI.

### Assinatura (Aba 5)
**Não existe** tabela de plano/assinatura. Para entregar somente leitura sem inventar billing:
- Criar `company_subscriptions` (1 por empresa): `plano (base|pro|max)`, `ciclo (mensal|anual)`, `status`, `proxima_cobranca`, `valor`, `limite_pedidos_mes`, `limite_conversas_mes`, `limite_usuarios`
- Contadores derivados em runtime (count em `pedidos`, `whatsapp_conversas`, `profiles` do mês corrente) — **sem nova tabela de uso**.

### Privacidade (Aba 7)
- Links: estáticos no frontend (Termos, Privacidade, Cookies)
- Solicitações: criar tabela `privacy_requests` (`tipo: exportacao|encerramento`, `status`, `solicitado_por`, `company_id`)

---

## 2. Migrations propostas (3 migrations)

### Migration 1 — Expandir `companies`
```sql
ALTER TABLE public.companies
  ADD COLUMN razao_social text,
  ADD COLUMN cnpj text,
  ADD COLUMN inscricao_estadual text,
  ADD COLUMN email_financeiro text,
  ADD COLUMN email_operacional text,
  ADD COLUMN responsavel_nome text,
  ADD COLUMN responsavel_cpf text,
  ADD COLUMN responsavel_telefone text,
  ADD COLUMN nome_publico text,
  ADD COLUMN telefone_publico text,
  ADD COLUMN endereco_publico text,
  ADD COLUMN tempo_entrega_min integer NOT NULL DEFAULT 45,
  ADD COLUMN raio_entrega_km numeric NOT NULL DEFAULT 0,
  ADD COLUMN canais_ativos jsonb NOT NULL DEFAULT
    '{"whatsapp":true,"balcao":true,"mesa":true,"delivery":true,"ifood":false}'::jsonb,
  ADD COLUMN mensagens_operacionais jsonb NOT NULL DEFAULT
    '{"loja_fechada":"","recebido":"","preparo":"","pronto":"","finalizado":""}'::jsonb;
```
RLS já existe em `companies` — sem alteração.

### Migration 2 — `company_subscriptions`
Tabela 1:1 com `companies`, RLS por `company_id`, GRANTs autenticated+service_role, política "Members view own subscription", "Super admins manage".

### Migration 3 — `privacy_requests`
`id, company_id, tipo, status, solicitado_por, created_at, resolved_at, notes`. RLS: admin da empresa cria/lê; super_admin gerencia.

---

## 3. Backend (server functions)

Arquivo novo: `src/lib/configuracoes.functions.ts`
- `getConfiguracoes` — retorna company + subscription + conexao whatsapp + fluxo chatbot
- `updateEmpresa` (Aba 1) — dados/endereço/responsável/público
- `updateOperacao` (Aba 2) — canais, funcionamento, horários, entrega, mensagens operacionais
- `updateWhatsappConfig` (Aba 3) — settings jsonb (bot, humano, auto-status)
- `updatePagamentos` (Aba 4) — reusar `updateCompanyPagamentos` existente
- `updateChatbot` (Aba 6) — usa `whatsapp_fluxos`
- `requestPrivacyAction` (Aba 7) — cria `privacy_requests`

Todas com `requireSupabaseAuth` + checagem `isAdmin || isSuperAdmin` para escrita; atendente só lê.
Validação com Zod: CNPJ (14), CPF (11), email, telefone, CEP (8), horários `HH:MM`.

---

## 4. Frontend

Nova rota: `src/routes/_app/configuracoes.tsx`
- Componente único com `<Tabs>` (shadcn) — 7 abas
- Subcomponentes por aba em `src/components/configuracoes/*` (Empresa, Operacao, Whatsapp, Pagamentos, Assinatura, Chatbot, Privacidade)
- Cada aba salva isoladamente, `toast.success/error`, invalidate query
- Atendente: campos `disabled`; Cozinha: redireciona p/ `/dashboard`
- Reaproveitar tokens do design system (sem cores cruas)
- Item na sidebar (`AppLayout`): "Configurações" (ícone `Settings`) — visível p/ admin/superadmin

---

## 5. Itens explicitamente NÃO incluídos
- Billing real / cobrança (Aba 5 é leitura, dados populados manualmente / via super admin)
- Integração Meta para health score / qualidade do número (placeholders)
- IA do chatbot / fluxos avançados (só estrutura base via `whatsapp_fluxos`)
- Integração financeira Asaas/MP (só registro em `integracoes`)
- Export real de dados (Aba 7 gera apenas a solicitação)

---

## 6. Compatibilidade
- `meu-restaurante.tsx` continua funcionando (subconjunto destes campos); pode ser removido em passo futuro ou marcado como legacy. **Não removerei nesta entrega** para evitar regressão.

---

## Aprovação
Aguardo seu OK para:
1. Rodar as 3 migrations
2. Criar `configuracoes.functions.ts`
3. Criar rota + componentes de abas
4. Adicionar item na sidebar
