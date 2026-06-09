## Plano — Onboarding Guiado + Limpeza Final

### ETAPA 1 — Remover elementos Lovable do ambiente publicado

**Diagnóstico:**
- O único elemento visível ao cliente final do tipo "Edit with Lovable" é o **badge injetado automaticamente nas publicações** (não está no código-fonte do projeto — é controlado pela plataforma).
- Não há referências hard-coded a Lovable em componentes, headers, footers ou metadados do app (`__root.tsx`, `AppLayout`, login, dashboard).
- Favicon, manifest, title e meta tags já estão com a marca **SaiuPedido**.

**Ação:** chamar `publish_settings--set_badge_visibility` com `hide_badge: true` (requer plano Pro+ — se não estiver disponível, informo no relatório final).

**Relatório pós-execução:** confirmar onde o badge aparecia (rodapé das páginas publicadas), o que foi removido e varredura final.

---

### ETAPAS 2–6 — Onboarding Guiado no Dashboard

**Boa notícia:** já existe a base sólida em `src/components/OnboardingChecklist.tsx` + `src/lib/onboarding.functions.ts`. Ela já entrega:
- Checklist de 5 itens (Meu Restaurante, Cardápio, Pagamentos, WhatsApp, Pedido Teste)
- Barra de progresso percentual
- Botões diretos por item (deep-links)
- Auto-ocultar quando 100% concluído
- Critérios baseados em dados existentes (companies, produtos, categorias, whatsapp_conexoes, pedidos)
- Realtime invalidation

**O que falta para atender ao briefing:**

1. **Fixar no topo do Dashboard Executivo** (hoje não está renderizado no `CompanyDashboard` reformulado). Precisa entrar como primeiro bloco, acima dos KPIs, apenas quando incompleto.

2. **Próxima ação recomendada (ETAPA 4):** banner destacado no topo do checklist mostrando **apenas** o próximo passo pendente, com CTA grande. Mensagens:
   - meu_restaurante → "Complete os dados do seu restaurante"
   - cardapio → "Cadastre seus primeiros produtos"
   - pagamentos → "Configure uma forma de pagamento"
   - whatsapp → "Conecte seu WhatsApp para começar a receber pedidos"
   - pedido_teste → "Realize seu primeiro pedido teste"

3. **Refinar critério "Meu Restaurante"** — hoje exige nome + telefone. Briefing pede nome + telefone + email. Adicionar verificação de `companies.email` em `getOnboardingStatus`.

4. **Mensagem de sucesso "Restaurante configurado"** quando 100% — já existe, manter.

5. **Texto da barra de progresso:** ajustar para "Seu restaurante está X% configurado".

### Wireframe (Dashboard ao abrir)

```text
┌──────────────────────────────────────────────────────────┐
│ Olá, João · Restaurante XYZ          [Novo pedido]      │
├──────────────────────────────────────────────────────────┤
│ ★ PRÓXIMA AÇÃO                                           │
│ Conecte seu WhatsApp para começar a receber pedidos.    │
│                                       [Conectar agora →] │
├──────────────────────────────────────────────────────────┤
│ Configuração inicial · Seu restaurante está 60% pronto  │
│ ████████████░░░░░░░  3/5                                │
│ ✔ Meu Restaurante                                        │
│ ✔ Cardápio                                               │
│ ✔ Pagamentos                                             │
│ ○ WhatsApp                              [Configurar →]   │
│ ○ Pedido Teste                          [Configurar →]   │
├──────────────────────────────────────────────────────────┤
│ [Alertas executivos]                                     │
│ [KPIs · Pipeline · Financeiro · Canais · etc.]          │
└──────────────────────────────────────────────────────────┘
```

Quando 100% → checklist some, fica apenas o chip discreto "Configuração inicial · 100%" no canto (comportamento atual).

### Critérios de conclusão (somente dados existentes)
| Item | Critério |
|---|---|
| Meu Restaurante | `companies.name` + `companies.phone` + `companies.email` preenchidos |
| Cardápio | ≥1 categoria ativa **e** ≥1 produto ativo |
| Pagamentos | ≥1 método em `companies.pagamento_metodos` = true |
| WhatsApp | ≥1 `whatsapp_conexoes` com `active=true` e `status='conectado'` |
| Pedido Teste | ≥1 registro em `pedidos` da empresa |

### Cálculo do percentual
`percent = round(itens_concluídos / 5 * 100)` — cada item vale 20%. (Já implementado.)

### Arquivos a alterar
1. `src/lib/onboarding.functions.ts` — adicionar checagem de `email` no critério `meu_restaurante` (campo já existe em `companies`, apenas adicionar ao select e ao boolean).
2. `src/components/OnboardingChecklist.tsx` — adicionar bloco "Próxima ação recomendada" no topo + ajustar texto da barra ("Seu restaurante está X% configurado").
3. `src/routes/_app/dashboard.tsx` — montar `<OnboardingChecklist />` como primeiro elemento do `CompanyDashboard`, acima dos alertas/KPIs.

### Ferramenta de plataforma
- `publish_settings--set_badge_visibility({ hide_badge: true })` para a ETAPA 1.

### Sem alterações em
banco, migrations, RLS, webhooks, Asaas, WhatsApp, integrações, regras de negócio, server functions de pedidos/financeiro.

**Aguardando aprovação para implementar.**
