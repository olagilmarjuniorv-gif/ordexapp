## Reposicionamento ORDEX → Sistema Operacional Food

Pivot grande. Vou dividir em fases para entregar valor rápido sem quebrar o sistema. Confirme a fase 1 antes de eu seguir.

---

### Fase 1 — Fundação (esta entrega)

**Banco de dados (migration)**
- Nova tabela `categorias` (id, company_id, name, sort_order, active)
- Nova tabela `adicionais_grupos` (id, company_id, name, min, max, required)
- Nova tabela `adicionais_opcoes` (id, grupo_id, name, price)
- Nova tabela `produto_grupos_adicionais` (produto_id, grupo_id) — vínculo
- Nova tabela `combos` + `combo_itens`
- Nova tabela `mesas` (id, company_id, numero, status: livre/ocupada/conta, capacidade)
- Adicionar colunas em `produtos`: `category_id`, `image_url`, `available`
- Adicionar colunas em `pedidos`:
  - `canal` (salao, whatsapp, retirada, delivery, balcao)
  - `mesa_id` (nullable)
  - `observacao` (text)
  - `paid_at` (timestamp)
- Mudar status default de `pedidos` para o novo fluxo: `novo`, `preparo`, `pronto`, `pago`
- RLS multiempresa em todas as novas tabelas

**Remoção do módulo Orçamentos**
- Remover rotas `/orcamentos`, `/orcamentos/novo`, `/orcamentos/$id`
- Remover do menu lateral e bottom nav
- Remover `orcamentos.functions.ts`
- Manter tabela `orcamentos` no banco por enquanto (não dropar — segurança)
- Remover criação de pedido a partir de orçamento; criar pedido direto

**Linguagem**
- Trocar textos comerciais → gastronômicos
- "Cliente" continua, mas adicionar contexto de canal/mesa

**Dashboard operacional (substituir o atual)**
- Cards: Pedidos ativos, Em preparo, Atrasados, Mesas abertas, Faturamento do dia, Ticket médio
- Item mais vendido (top 5)
- Pedidos por canal (gráfico)
- Manter SalesChart simplificado

**Roles**
- Adicionar role `atendente` no enum `app_role` (manter `admin`, `super_admin`)
- Renomear/aposentar roles antigas que não se aplicam

---

### Fase 2 — Operação (próxima entrega, após você aprovar Fase 1)

- Tela de Mesas (mapa visual, abrir/fechar, status)
- Fluxo rápido de novo pedido mobile-first (mesa → produtos → adicionais → obs → enviar)
- Gestão de Categorias e Adicionais no admin
- Combos
- Suporte a `canal` no formulário de pedido

### Fase 3 — Display & PWA

- Tela `/cozinha` em modo display (tipografia grande, cores por status, sem interação)
- Auto-refresh via Supabase Realtime
- PWA básico (manifest only, sem service worker — instalável)

### Fase 4 — WhatsApp (preparação)

- Endpoint `/api/public/whatsapp/webhook` placeholder com verificação de assinatura
- Estrutura de canal já presente desde Fase 1

---

### Confirmações necessárias

1. **Tabela `orcamentos`**: posso deletar dados/dropar? Recomendo **manter no banco e apenas remover da UI** — reversível.
2. **Status atuais de pedidos** (`pending`, `processing`, `completed`, `cancelled`) → migrar para (`novo`, `preparo`, `pronto`, `pago`)? Vou mapear: pending→novo, processing→preparo, completed→pago, cancelled→cancelado.
3. **Fase 1 inclui só estrutura + remoção + dashboard novo**. Telas de Mesas/Cozinha/PWA virão nas fases seguintes — ok?

Aprova a Fase 1 do jeito acima?