# Reestruturação de Assinatura, UX e Onboarding

Apenas UX/navegação/formulários. Sem mexer em: integração Asaas, webhook, fluxo PIX, ativação automática, RLS, multiempresa, trial, regras de negócio.

## 1. Consolidar Assinatura num único lugar
- Remover item **"Assinatura"** do menu lateral (`AppLayout.tsx`, nav do admin).
- Manter a rota `/assinatura/escolher-plano` viva (usada por trial expirado e fluxo de upgrade), mas acessada **somente** por dentro de **Configurações → Assinatura**.
- Em Configurações, transformar a aba *Assinatura* na central única (hoje a aba existe, mas é fraca).

## 2. Tela central de Assinatura (aba em Configurações)
Cards/seções:
1. **Plano atual** — plano, status, ciclo, início, próxima cobrança, valor.
2. **Consumo do plano** — barras (`Progress`) para Pedidos do mês, Conversas WhatsApp do mês, Usuários ativos. Formato `utilizado / limite`.
3. **Excedentes acionáveis** — quando algo passa do limite, mostrar mensagem clara + botões: `Contratar usuário adicional` (placeholder/disabled "em breve") e `Alterar plano` (abre fluxo escolher-plano).
4. **Forma de pagamento** — radios `PIX` (selecionado) e `Cartão de Crédito (Em breve)` desabilitado. Visual apenas, sem lógica.
5. **Histórico de cobranças** — tabela com Data / Valor / Status / Forma / Link (quando houver `metadata.invoiceUrl` ou similar).
6. **Botão "Alterar / Contratar plano"** → leva a `/assinatura/escolher-plano`.

## 3. Anti-cobrança duplicada
Em `createPixForIntent` (server fn), antes de criar nova cobrança Asaas: verificar se a empresa já possui `cobrancas` com `status = 'pendente'` e `payment_method = 'PIX'` ainda válida (não vencida). Se existir, **reutilizar** (retornar dados Pix da cobrança existente em vez de criar nova). Na UI de escolher-plano: se intent pendente já existe, exibir aviso "Você já possui uma cobrança pendente" + botão `Continuar pagamento` que abre o QR da cobrança existente.

Sem mudar fluxo Asaas em si — apenas curto-circuito antes da chamada.

## 4. Simplificar Configurações → Empresa
Reorganizar a aba "Empresa" em 4 blocos exatos:
- **Dados da Empresa**: Razão Social\*, CNPJ\*, Telefone Principal\*, E-mail Principal\*
- **Responsável**: Nome, CPF, Telefone
- **Endereço**: CEP, Rua, Número, Complemento, Bairro, Cidade, Estado
- **Informações Públicas**: Nome Exibido, Telefone Exibido, Endereço Exibido

Remover dos formulários (campos do banco permanecem para não quebrar nada):
- Nome Fantasia, Inscrição Estadual, E-mail Financeiro, E-mail Operacional
- E-mail Financeiro/Operacional passam a ser preenchidos automaticamente com o E-mail Principal no save (para manter compat. com Asaas).

Adicionar `*` nos obrigatórios + helper text:
> "Esses dados são necessários para emissão de cobranças e ativação da assinatura."

## 5. Validação client-side antes do Asaas
Na tela `escolher-plano`, antes de chamar `createPixForIntent`, validar localmente:
- Razão Social, CNPJ, Telefone, E-mail (da empresa)
- CPF, Nome, Telefone (do responsável)

Se algum faltar: **não chamar Asaas**. Mostrar toast/inline error com link "Completar dados em Configurações → Empresa". (O backend continua validando como já faz hoje — não alteramos lógica de negócio.)

## 6. Onboarding/UX geral
- Reduzir cliques: trial expirado + admin → CTA direto para Configurações → Assinatura.
- Banner de trial existente mantido.
- Sem novas rotas; sem mudança de banco.

## Impacto

**Arquivos a alterar:**
- `src/components/AppLayout.tsx` — remover item Assinatura do menu admin.
- `src/routes/_app/configuracoes.tsx` — simplificar aba Empresa + reformular aba Assinatura como central.
- `src/routes/_app/assinatura.escolher-plano.tsx` — validação pré-Asaas + reaproveitar cobrança pendente.
- `src/lib/asaas-payments.ts` (ou `asaas.functions.ts`) — `createPixForIntent` retorna cobrança pendente existente em vez de criar nova.
- `src/lib/assinaturas.functions.ts` — nova server fn `getBillingOverview` (plano + consumo + excedentes + histórico).
- `src/components/TrialExpiredOverlay.tsx` — CTA aponta para `/configuracoes?tab=assinatura`.

**Banco de dados:** zero migrações. Campos antigos (`inscricao_estadual`, `nome_fantasia` se existir, `email_financeiro`, `email_operacional`) permanecem; apenas saem do formulário e são auto-preenchidos a partir do email principal no save.

**Integrações Asaas:** nenhuma mudança de payload, endpoint ou ordem de chamadas. Único acréscimo é o curto-circuito "se já existe cobrança pendente, reutiliza" — não altera contrato com Asaas.

**Antes → Depois:**
- Antes: 2 entradas (menu + aba), formulário Empresa com ~12 campos misturados, sem visão de consumo, possibilidade de gerar Pix duplicado, mensagem "excedente" sem ação.
- Depois: 1 entrada (Configurações → Assinatura), formulário Empresa em 4 blocos enxutos com obrigatórios marcados, central de assinatura com plano + consumo + excedentes acionáveis + histórico + preparação cartão, Pix pendente reutilizado.

Confirme para eu executar.
