## Motor Conversacional WhatsApp — SaiuPedido

Construir o motor de pedidos via WhatsApp com máquina de estados multiempresa, integrado às tabelas já existentes (`produtos`, `categorias`, `pedidos`, `whatsapp_conexoes`, `whatsapp_conversas`, `whatsapp_mensagens`).

---

### 1. Migração de banco

Criar 4 tabelas novas + RLS multiempresa:

- **`whatsapp_sessoes`** — uma por (empresa + telefone). Campos: `company_id`, `customer_phone`, `estado_atual` (text), `carrinho` (jsonb), `contexto` (jsonb — última categoria/produto sendo selecionado), `atendente_assumiu` (bool), `last_event_at`, `expires_at`.
- **`whatsapp_carrinhos`** — histórico de carrinhos finalizados (auditoria). Campos: `sessao_id`, `company_id`, `status`, `valor_total`, `observacoes`, `pedido_id`.
- **`whatsapp_carrinho_itens`** — itens de cada carrinho. Campos: `carrinho_id`, `produto_id`, `quantidade`, `valor_unitario`, `observacoes`.
- **`whatsapp_fluxos`** — configuração por empresa. Campos: `company_id` (unique), `mensagem_boas_vindas`, `mensagem_fechamento`, `mensagem_sem_atendimento`, `ativo`.

RLS: todas com `company_id = get_user_company(auth.uid())` + super_admin.

Adicionar `realtime` para `pedidos` (se já não tem) e nas novas tabelas relevantes.

---

### 2. Máquina de estados (`src/lib/whatsapp-engine.server.ts`)

Estados:
```
aguardando_inicio → escolhendo_categoria → escolhendo_produto
  → escolhendo_adicionais → escolhendo_quantidade → escrevendo_observacao
  → confirmando_pedido → escolhendo_pagamento → pedido_finalizado
  → conversa_encerrada
aguardando_atendente (sai do fluxo automático)
```

Funções principais:
- `getOrCreateSession(companyId, phone)` — busca/cria sessão.
- `processInboundMessage({ companyId, conexaoId, phone, text })` — roteia para handler do estado atual, retorna `{ reply, nextState }`.
- `handlers[estado]` — um por estado, lê texto + carrinho e produz transição.
- `triggerHumanHandoff(sessao)` — palavras-chave: `atendente`, `ajuda`, `falar com alguém`, `humano`.
- `resetIfTimeout(sessao)` — se `last_event_at` > 30 min, encerra.
- `finalizePedido(sessao)` — cria registro em `pedidos` com `items` montados a partir do carrinho, canal `delivery`, retorna número curto.

Navegação:
- Categoria: lista `categorias` ativas da empresa, mostra numerado.
- Produto: lista produtos da categoria escolhida.
- Adicionais: por enquanto pular (estrutura preparada — texto "sem adicionais" se grupo vazio).
- Quantidade: parse de número (default 1).
- Observação: aceita texto livre ou "pular".
- Confirmação: mostra resumo + total, aguarda "sim/não/adicionar mais".

---

### 3. Webhook integration

Atualizar `src/routes/api/public/webhooks/whatsapp.ts`:
- Após persistir mensagem inbound, chamar `processInboundMessage`.
- Enviar `reply` via `sendWhatsappCloud` (substitui o `WELCOME_MESSAGE` fixo atual).
- Persistir mensagem outbound.

---

### 4. Server functions (frontend)

`src/lib/whatsapp-sessoes.functions.ts`:
- `listSessoes` — sessões ativas da empresa.
- `assumirAtendimento(sessaoId)` — marca `atendente_assumiu=true`.
- `liberarAtendimento(sessaoId)` — volta para fluxo automático.
- `enviarMensagemManual(sessaoId, body)` — atendente envia texto pelo painel.

`src/lib/whatsapp-fluxos.functions.ts`:
- `getFluxo` / `upsertFluxo` — config de mensagens.

---

### 5. Painel operacional

Página existente `_app/pedidos/index.tsx` já mostra pedidos. Garantir realtime via `useRealtimeInvalidate("pedidos", [...])`. Adicionar colunas Kanban: novos / preparo / pronto / pago / cancelado (já existem como status).

Página existente `_app/mensagens.tsx` — adicionar listagem de sessões WhatsApp ativas + botão "assumir atendimento" + envio manual.

---

### 6. Segurança

- Tokens lidos apenas server-side via `whatsapp_conexoes.access_token` ou env.
- RLS validada com `get_user_company`.
- Webhook valida assinatura HMAC SHA-256 (já implementado).

---

### Arquivos a criar/editar

**Criar:**
- `supabase/migrations/XXX_whatsapp_engine.sql`
- `src/lib/whatsapp-engine.server.ts`
- `src/lib/whatsapp-sessoes.functions.ts`
- `src/lib/whatsapp-fluxos.functions.ts`

**Editar:**
- `src/routes/api/public/webhooks/whatsapp.ts` — chamar engine
- `src/routes/_app/mensagens.tsx` — painel sessões WhatsApp
- `src/routes/_app/pedidos/index.tsx` — garantir realtime (se faltando)

Sem foco em design — UI funcional usando componentes existentes (card-premium, badges).
