# Plano de Consolidação — ORDEX Food

Escopo enorme. Vou executar em **4 fases sequenciais**, cada uma validada antes da próxima. Você aprova este plano e eu sigo executando fase por fase, reportando ao final de cada uma.

---

## Análise de Impacto e Riscos

**Risco alto:**
- Trocar `vendedor` → `atendente` mexe no enum `app_role` no Postgres. Enum não aceita rename trivial — exige `ALTER TYPE ADD VALUE 'atendente'`, migração de dados em `user_roles`, depois remoção do valor antigo (que requer recriar o tipo). Vou fazer em duas migrations seguras.
- Realtime via Supabase Channels exige `ALTER PUBLICATION supabase_realtime` + `REPLICA IDENTITY FULL` em `pedidos`, `mesas`. Se não fizer isso, eventos vêm vazios.
- Remover `orcamentos`, `stock`, `minStock`, `orcamento_id` é destrutivo. Preciso garantir que nada no código referencia mais.
- PWA dentro do iframe da Lovable causa cache stale. Vou implementar **manifest-only** (instalável, sem service worker) — é o que a documentação Lovable recomenda quando não há offline.
- WhatsApp real (webhook + API) exige conta Meta Business + secret. Vou só preparar arquitetura (tabela `mensagens`, edge function stub), não conectar.

**Risco médio:**
- Remover `bootstrapSuperAdmin` deixa projetos novos sem caminho de promoção. Vou substituir por seed manual via SQL documentado.
- Adicionais/combos UI completa é grande superfície. Vou entregar UI funcional simples, não polished.

---

## FASE A — Operacional (prioridade absoluta)

### A1. Role `atendente`
- Migration 1: `ALTER TYPE app_role ADD VALUE 'atendente'`; UPDATE `user_roles` SET role='atendente' WHERE role='vendedor'.
- Migration 2: recriar enum sem `vendedor` (drop default → swap → restore).
- Atualizar `users.functions.ts` (ROLES, COMPANY_ROLES), `auth.tsx`, `usuarios.tsx`, seeds, validações Zod.
- Adicionar flag `canSeeFinancials` no contexto de auth = `isAdmin`.
- Esconder em `dashboard.tsx`: faturamento, ticket médio, vendas totais, top item — para `atendente`.
- AppLayout: ocultar `/empresas`, `/usuarios` para atendente.

### A2. Cozinha operacional
- Botões inline nos cards: **Iniciar preparo** / **Marcar pronto** / **Pago** (configurável).
- Realtime via Supabase Channels (substituir polling 15s).
- Animação `framer-motion` ao chegar pedido novo.
- Destaque rosa pulsante para atrasados (>25min).
- Ordenação: pronto > atrasado > novo > preparo, dentro de cada por tempo.
- Som opcional (Web Audio API, toggle persistido em localStorage).
- Modo TV/fullscreen + dark mode dedicado (rota `/cozinha?tv=1`).

### A3. Comanda por mesa
- Nova rota `/_app/mesas/$id` (comanda).
- Função `getComandaMesa(mesaId)`: lista pedidos ativos + total + opened_at.
- Botões: **Fechar conta** (status `conta`), **Marcar como pago** (todos pedidos → `pago` + paid_at), **Liberar mesa** (status `livre`, opened_at=null).
- Função `pagarMesa(mesaId)` em transação.
- Estrutura preparada para split futuro (campo `split_count` opcional na mesa).

### A4. Realtime
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE pedidos, mesas`.
- Hook `useRealtimePedidos()`, `useRealtimeMesas()` que invalida queries TanStack.
- Remover `refetchInterval` de cozinha, mesas, dashboard, pedidos.

### A5. Fluxo rápido de pedido
- Filtro por categoria (chips horizontais).
- Carrinho lateral fixo (drawer em mobile).
- Criação inline de cliente (modal compacto) e produto (apenas admin).
- Observação rápida por item.
- Botão "Enviar pedido" sticky bottom.

---

## FASE B — Catálogo Food

### B1. Categorias UI
- Rota `/_app/categorias` (CRUD simples).
- `produtos.tsx`: select de categoria, filtro por categoria, drag para sort_order.

### B2. Adicionais
- Rota `/_app/adicionais` (grupos + opções).
- Vincular grupos a produto via `produto_grupos_adicionais`.
- Modal no fluxo de pedido: ao adicionar produto com adicionais, abrir picker.
- Item do pedido carrega `adicionais: [{name, price}]` e soma no preço.

### B3. Combos
- Rota `/_app/combos`.
- `combo_itens` já existe. UI para criar combo com produtos vinculados.
- Combos aparecem no grid de produtos do pedido com badge "COMBO".

### B4. Disponibilidade rápida
- Toggle `available` direto no card de produto (atendente pode usar).
- Server fn `toggleProdutoAvailable`.

### B5. Imagens
- Bucket Storage `produto-images` público.
- Upload no form de produto, preview, thumb no grid.

---

## FASE C — WhatsApp (arquitetura)

### C1. Tabelas
- `mensagens` (id, company_id, cliente_id, pedido_id?, direction, body, status, raw_payload jsonb, created_at).
- RLS multi-tenant igual padrão.

### C2. Edge function stubs
- `/api/public/webhooks/whatsapp` (POST, valida signature placeholder, persiste em `mensagens`).
- Service `whatsapp.functions.ts` com `sendMessage(clientePhone, body)` retornando mock até secret existir.

### C3. WhatsappButton
- Corrigir tokens (`bg-whatsapp` não existe). Adicionar em `styles.css`: `--whatsapp: oklch(0.72 0.17 145)` e `--whatsapp-foreground`.
- Mensagens automáticas por status (templates configuráveis depois).

---

## FASE D — Limpeza & finalização

### D1. Remover legado
- Migration: DROP `orcamentos`, DROP `pedidos.orcamento_id`, DROP `produtos.stock`, DROP `produtos.minStock`.
- Remover qualquer referência em código.

### D2. Refatoração
- Extrair `getCaller()` para `src/lib/auth.server.ts` único.
- Tipos compartilhados em `src/lib/types.ts`.
- QueryKeys constantes em `src/lib/query-keys.ts`.

### D3. Segurança
- Remover `bootstrapSuperAdmin`. Documentar seed manual.
- Configurar `password_hibp_enabled: true` via configure_auth.
- Validações Zod fortalecidas em todos inputs.

### D4. PWA (manifest-only)
- `public/manifest.json` + ícones + `<link rel="manifest">`.
- `display: standalone`, theme_color, background_color.
- **Sem service worker** (causa stale no preview Lovable).

### D5. UX final
- Tipografia display: trocar Inter por algo mais character-driven (Bricolage Grotesque ou Space Grotesk para display).
- Ajustes de densidade no AppLayout para feel "operacional".

---

## Ordem de execução e checkpoints

1. **Fase A** completa → reporto + você valida no preview.
2. **Fase B** completa → reporto.
3. **Fase C** completa → reporto.
4. **Fase D** completa → relatório final consolidado.

Cada fase termina com: build verde, smoke test no preview, lista de arquivos alterados.

## Detalhes técnicos

**Migrations previstas:** ~8 (atendente fase 1+2, realtime publication, mesas split_count, mensagens table, drop legado, storage bucket).

**Tabelas novas:** `mensagens`.
**Tabelas removidas:** `orcamentos`.
**Colunas removidas:** `pedidos.orcamento_id`, `produtos.stock`, `produtos.minStock`.
**Enums alterados:** `app_role` (remove `vendedor`, add `atendente`).
**Realtime habilitado em:** `pedidos`, `mesas`.

**Rotas novas:** `/categorias`, `/adicionais`, `/combos`, `/mesas/$id` (comanda), `/cozinha` com modo TV.
**Rotas removidas:** nenhuma além das já feitas (orcamentos).

**Estimativa:** Fase A é ~60% do trabalho. Vou começar por ela imediatamente após sua aprovação.

---

**Confirma para eu iniciar pela Fase A?**
