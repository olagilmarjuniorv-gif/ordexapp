# Pacote de Melhorias Operacionais

Refatoração focada em fluxo operacional. **Não toca em** RLS, multiempresa, auth, integrações, WhatsApp ou lógica financeira existente.

## 1. Novos estados operacionais

Adicionar status `finalizado` ao enum de status de pedidos:

```
novo → preparo → pronto → finalizado → (pago opcional, ou cancelado)
```

`pago` deixa de ser status operacional e passa a ser exclusivamente representado por `status_financeiro`. Compatibilidade: pedidos antigos com `status='pago'` continuam funcionando (tratados como finalizados na UI).

**Migration:** apenas adicionar `'finalizado'` à lista de status válidos no constraint/validação. Não migrar dados antigos.

## 2. Server functions — novas regras automáticas

Em `src/lib/pedidos.functions.ts`:

- **`updatePedidoStatus`**: ao mudar para `pronto`, se `status_financeiro='pago'` → grava `finalizado` direto.
- **`updatePedidoStatusFinanceiro`**: ao marcar `pago`, se `status='pronto'` → grava `finalizado` direto.
- **Auto-liberar mesa**: após qualquer update que resulte em `finalizado` ou `cancelado`, se a mesa não tem mais pedidos ativos (status ∉ {finalizado, cancelado}), grava `mesas.status='livre'`.
- **Nova action `voltarParaCozinha`**: muda status de `pronto` → `preparo`. Permitido para admin/atendente.

Em `src/lib/mesas.functions.ts`:
- `pagarMesa` continua existindo mas o RPC `pagar_mesa` agora deve marcar pedidos como `finalizado` + `status_financeiro=pago` (atualizar a SQL function).

## 3. Cozinha (`/cozinha`)

- Filtra somente `status IN ('novo','preparo')`. Pedidos `pronto` somem da tela imediatamente.
- Ações: Iniciar preparo / Marcar pronto. Sem botão de pagamento, entrega, finalizar.

## 4. Notificação de pedido pronto

Já existe `usePedidoProntoNotify` em `src/hooks/use-pedido-pronto-notify.ts`. Garantir que está ativo no `AppLayout` para roles admin/atendente.

## 5. Nova fila "Expedição" (`/expedicao`)

Nova rota `src/routes/_app/expedicao.tsx`. Lista pedidos com `status='pronto'`, agrupados/filtráveis por canal (mesa/balcao/retirada/delivery). Cada card mostra: #curto, cliente, mesa, canal, horário, ações conforme canal:

- **mesa**: "Servido" → marca finalizado (ou aguarda pagamento)
- **balcão**: "Entregue ao cliente" → finalizado
- **retirada**: "Retirado" → finalizado
- **delivery**: "Saiu para entrega" → mantém em estado intermediário; "Entregue" → finalizado

Sub-estados (`aguardando_servir`, `em_consumo`, `saiu_entrega`, `entregue`, etc.) ficam em coluna nova `pedidos.fase_canal` (text, nullable) — registra a etapa dentro do canal sem inflar o enum principal.

## 6. Tela de Pedidos (`/pedidos`)

Substituir chips poluídos por 3 selects simples:

- **Status**: Todos | Novo | Em preparo | Pronto | Finalizado | Cancelado | Atrasado
- **Pagamento**: Todos | Pago | Aguardando | Na entrega | Na retirada
- **Período**: Hoje (default) | Semana | Mês | Ano

## 7. Cards de pedido — limpeza visual

Layout final:
```
Mesa 1 • Paulo Rodrigues          R$ 91,30
🟢 Pago   💳 Pagamento na entrega
```

Sem duplicação de "Pago • Na entrega". Badge financeiro único.

## 8. Botão "Marcar como pago"

Em todos os pontos (lista de pedidos, detalhe, mesa): só renderiza se `status_financeiro !== 'pago'`.

## 9. Botão "Voltar para cozinha"

Aparece em pedidos com `status='pronto'` para admin/atendente. Chama `voltarParaCozinha`.

## 10. Remover dependência manual de "Liberar mesa"

Botão continua existindo como fallback admin, mas o fluxo normal libera automático (item 2).

## Arquivos afetados

- **Migration**: ajustar validação de status + `pagar_mesa` RPC
- `src/lib/pedidos.functions.ts` — auto-finalização, auto-liberação, `voltarParaCozinha`, `setFaseCanal`
- `src/lib/mesas.functions.ts` — helper de auto-liberação
- `src/routes/_app/cozinha.tsx` — filtrar prontos
- `src/routes/_app/expedicao.tsx` — nova rota
- `src/routes/_app/pedidos/index.tsx` — 3 filtros, cards limpos
- `src/routes/_app/pedidos/$id.tsx` — botão pago condicional + voltar p/ cozinha
- `src/routes/_app/mesas/$id.tsx` — botão pago condicional
- `src/components/AppLayout.tsx` — link "Expedição" no nav + garantir hook de notificação ativo

## Validação

Smoke test manual nos 4 papéis (admin, super_admin, atendente, cozinha) após build verde:
- Cozinha → Pronto: pedido some da cozinha, aparece em Expedição, toca som no admin.
- Pedido pago + pronto → finalizado automaticamente.
- Último pedido da mesa finalizado → mesa volta para `livre` sem clique.
- Pedido pago não mostra mais "Marcar como pago".
- "Voltar para cozinha" devolve pedido para fila da cozinha.

## Riscos

- Pedidos legados com `status='pago'` precisam ser tratados como "finalizados" na UI dos filtros (mapeamento na exibição, sem migrar dados).
- A SQL function `pagar_mesa` precisa ser regravada para usar `finalizado` em vez de `pago` no campo `status`. Pedidos antigos não são alterados.
