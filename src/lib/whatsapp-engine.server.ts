import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWhatsappCloud } from "./whatsapp.server";

export type EstadoConversa =
  | "aguardando_inicio"
  | "escolhendo_categoria"
  | "escolhendo_produto"
  | "escolhendo_adicionais"
  | "escolhendo_quantidade"
  | "escrevendo_observacao"
  | "confirmando_pedido"
  | "escolhendo_entrega"
  | "escolhendo_pagamento"
  | "resumo_final"
  | "aguardando_atendente"
  | "pedido_finalizado"
  | "conversa_encerrada";

type FormaPagamentoCode =
  | "pix_online"
  | "dinheiro"
  | "credito_presencial"
  | "debito_presencial"
  | "pix_presencial"
  | "pagamento_entrega"
  | "pagamento_retirada";

type StatusFinanceiroCode =
  | "aguardando_pagamento"
  | "pagamento_entrega"
  | "pagamento_retirada";

const PAGAMENTO_LABELS: Record<FormaPagamentoCode, string> = {
  pix_online: "Pix online",
  dinheiro: "Dinheiro",
  credito_presencial: "Crédito presencial",
  debito_presencial: "Débito presencial",
  pix_presencial: "Pix presencial",
  pagamento_entrega: "Pagamento na entrega",
  pagamento_retirada: "Pagamento na retirada",
};

function statusFinanceiroFor(forma: FormaPagamentoCode): StatusFinanceiroCode {
  if (forma === "pagamento_entrega") return "pagamento_entrega";
  if (forma === "pagamento_retirada") return "pagamento_retirada";
  return "aguardando_pagamento";
}

async function getCompanyPagamentos(companyId: string) {
  const { data } = await supabaseAdmin
    .from("companies")
    .select("pagamento_metodos, permitir_pagamento_entrega, permitir_pagamento_retirada, delivery_ativo, retirada_ativa")
    .eq("id", companyId)
    .maybeSingle();
  return data;
}

async function listFormasPagamentoAtivas(companyId: string, canal: "delivery" | "retirada"): Promise<FormaPagamentoCode[]> {
  const cfg = await getCompanyPagamentos(companyId);
  const metodos = (cfg?.pagamento_metodos as Record<string, boolean>) ?? {};
  const ordered: FormaPagamentoCode[] = [
    "pix_online",
    "dinheiro",
    "credito_presencial",
    "debito_presencial",
    "pix_presencial",
    "pagamento_entrega",
    "pagamento_retirada",
  ];
  return ordered.filter((f) => {
    if (!metodos[f]) return false;
    if (f === "pagamento_entrega") {
      return canal === "delivery" && cfg?.permitir_pagamento_entrega !== false;
    }
    if (f === "pagamento_retirada") {
      return canal === "retirada" && cfg?.permitir_pagamento_retirada !== false;
    }
    return true;
  });
}

const TIMEOUT_MS = 30 * 60 * 1000;

const HANDOFF_KEYWORDS = ["atendente", "ajuda", "falar com alguém", "falar com alguem", "humano", "operador"];
const MENU_KEYWORDS = ["oi", "ola", "olá", "menu", "cardapio", "cardápio", "começar", "comecar", "iniciar"];

type CartItem = {
  produto_id: string;
  nome: string;
  preco: number;
  quantidade: number;
  observacao?: string;
};

type Sessao = {
  id: string;
  company_id: string;
  conexao_id: string | null;
  customer_phone: string;
  estado_atual: EstadoConversa;
  carrinho: CartItem[];
  contexto: Record<string, any>;
  atendente_assumiu: boolean;
  last_event_at: string;
};

function brl(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function isHandoff(text: string) {
  const t = normalize(text);
  return HANDOFF_KEYWORDS.some((k) => t.includes(k));
}

function isMenuTrigger(text: string) {
  const t = normalize(text);
  return MENU_KEYWORDS.includes(t);
}

async function getCompanyName(companyId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("companies").select("name").eq("id", companyId).maybeSingle();
  return (data?.name as string) ?? "nosso restaurante";
}

async function getFluxo(companyId: string) {
  const { data } = await supabaseAdmin
    .from("whatsapp_fluxos")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (data) return data;
  const { data: created } = await supabaseAdmin
    .from("whatsapp_fluxos")
    .insert({ company_id: companyId })
    .select("*")
    .single();
  return created!;
}

async function getOrCreateSession(companyId: string, conexaoId: string | null, phone: string): Promise<Sessao> {
  const { data: existing } = await supabaseAdmin
    .from("whatsapp_sessoes")
    .select("*")
    .eq("company_id", companyId)
    .eq("customer_phone", phone)
    .maybeSingle();

  if (existing) {
    const last = new Date(existing.last_event_at as string).getTime();
    if (Date.now() - last > TIMEOUT_MS) {
      const { data: reset } = await supabaseAdmin
        .from("whatsapp_sessoes")
        .update({
          estado_atual: "aguardando_inicio",
          carrinho: [],
          contexto: {},
          atendente_assumiu: false,
          last_event_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      return reset as unknown as Sessao;
    }
    return existing as unknown as Sessao;
  }

  const { data: created, error } = await supabaseAdmin
    .from("whatsapp_sessoes")
    .insert({
      company_id: companyId,
      conexao_id: conexaoId,
      customer_phone: phone,
      estado_atual: "aguardando_inicio",
      carrinho: [],
      contexto: {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return created as unknown as Sessao;
}

async function updateSession(id: string, patch: Partial<Sessao>) {
  await supabaseAdmin
    .from("whatsapp_sessoes")
    .update({ ...patch, last_event_at: new Date().toISOString() })
    .eq("id", id);
}

async function listCategorias(companyId: string) {
  const { data } = await supabaseAdmin
    .from("categorias")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("sort_order")
    .order("name");
  return data ?? [];
}

async function listProdutos(companyId: string, categoryId: string) {
  const { data } = await supabaseAdmin
    .from("produtos")
    .select("id, name, price")
    .eq("company_id", companyId)
    .eq("category_id", categoryId)
    .eq("active", true)
    .eq("available", true)
    .order("name");
  return data ?? [];
}

function cartTotal(cart: CartItem[]) {
  return cart.reduce((s, i) => s + i.preco * i.quantidade, 0);
}

function cartSummary(cart: CartItem[]) {
  if (cart.length === 0) return "_Carrinho vazio_";
  const lines = cart.map(
    (i, idx) =>
      `${idx + 1}. ${i.quantidade}x ${i.nome} — ${brl(i.preco * i.quantidade)}${i.observacao ? `\n   _obs: ${i.observacao}_` : ""}`,
  );
  lines.push(`\n*Total: ${brl(cartTotal(cart))}*`);
  return lines.join("\n");
}

async function mostrarCategorias(companyId: string): Promise<{ reply: string; ctx: Record<string, any> }> {
  const cats = await listCategorias(companyId);
  if (cats.length === 0) {
    return { reply: "Desculpe, o cardápio está indisponível no momento.", ctx: {} };
  }
  const list = cats.map((c, i) => `${i + 1}️⃣ ${c.name}`).join("\n");
  return {
    reply: `*Escolha uma categoria:*\n\n${list}\n\nDigite o número da opção desejada. (ou *atendente* para falar com alguém)`,
    ctx: { categorias_ids: cats.map((c) => c.id) },
  };
}

async function mostrarProdutos(
  companyId: string,
  categoryId: string,
): Promise<{ reply: string; ctx: Record<string, any> }> {
  const prods = await listProdutos(companyId, categoryId);
  if (prods.length === 0) {
    return { reply: "Nenhum produto disponível nessa categoria. Digite *menu* para voltar.", ctx: {} };
  }
  const list = prods.map((p, i) => `${i + 1}. ${p.name} — ${brl(Number(p.price))}`).join("\n");
  return {
    reply: `*Produtos:*\n\n${list}\n\nDigite o número do produto desejado. (ou *0* para voltar)`,
    ctx: { produtos: prods.map((p) => ({ id: p.id, nome: p.name, preco: Number(p.price) })) },
  };
}

async function finalizarPedido(sessao: Sessao): Promise<string> {
  const cart = sessao.carrinho;
  const total = cartTotal(cart);

  // cria cliente (ou recupera) por telefone
  let clienteId: string | null = null;
  const { data: cliExist } = await supabaseAdmin
    .from("clientes")
    .select("id")
    .eq("company_id", sessao.company_id)
    .eq("phone", sessao.customer_phone)
    .maybeSingle();
  if (cliExist) clienteId = cliExist.id as string;
  else {
    const { data: cliNew } = await supabaseAdmin
      .from("clientes")
      .insert({
        company_id: sessao.company_id,
        name: `WhatsApp ${sessao.customer_phone.slice(-4)}`,
        phone: sessao.customer_phone,
      })
      .select("id")
      .single();
    clienteId = (cliNew?.id as string) ?? null;
  }

  // cria carrinho de auditoria
  const { data: cart_row } = await supabaseAdmin
    .from("whatsapp_carrinhos")
    .insert({
      company_id: sessao.company_id,
      sessao_id: sessao.id,
      status: "finalizado",
      valor_total: total,
    })
    .select("id")
    .single();

  if (cart_row) {
    await supabaseAdmin.from("whatsapp_carrinho_itens").insert(
      cart.map((i) => ({
        carrinho_id: cart_row.id,
        produto_id: i.produto_id,
        nome: i.nome,
        quantidade: i.quantidade,
        valor_unitario: i.preco,
        observacoes: i.observacao ?? null,
      })),
    );
  }

  // cria pedido oficial — precisa user_id (usa primeiro admin/owner da empresa como fallback)
  const { data: anyMember } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("company_id", sessao.company_id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!anyMember?.id) {
    throw new Error("Sem operador disponível para registrar pedido");
  }

  const items = cart.map((i) => ({
    kind: "produto",
    product_id: i.produto_id,
    combo_id: null,
    name: i.nome,
    quantity: i.quantidade,
    price: i.preco,
    observacao: i.observacao ?? null,
    adicionais: [],
  }));

  const { data: pedido, error: pedErr } = await supabaseAdmin
    .from("pedidos")
    .insert({
      company_id: sessao.company_id,
      user_id: anyMember.id,
      client_id: clienteId,
      canal: "delivery",
      items,
      total_amount: total,
      status: "novo",
      external_provider: "whatsapp",
    })
    .select("id")
    .single();

  if (pedErr) throw new Error(pedErr.message);

  if (cart_row && pedido) {
    await supabaseAdmin.from("whatsapp_carrinhos").update({ pedido_id: pedido.id }).eq("id", cart_row.id);
  }

  return pedido!.id as string;
}

/**
 * Núcleo do motor: processa uma mensagem recebida e retorna a resposta a enviar.
 */
export async function processInboundMessage(opts: {
  companyId: string;
  conexaoId: string | null;
  phone: string;
  text: string;
}): Promise<string | null> {
  const { companyId, conexaoId, phone, text } = opts;
  const t = text.trim();
  const tl = normalize(t);

  const sessao = await getOrCreateSession(companyId, conexaoId, phone);

  // Atendente humano assumiu — não responder automaticamente
  if (sessao.atendente_assumiu) {
    return null;
  }

  // Handoff
  if (isHandoff(t)) {
    const fluxo = await getFluxo(companyId);
    await updateSession(sessao.id, { estado_atual: "aguardando_atendente" });
    return `${fluxo.mensagem_sem_atendimento}\n\nUm atendente entrará em contato em breve.`;
  }

  // Comando global: cancelar/sair
  if (["cancelar", "sair", "encerrar"].includes(tl)) {
    await updateSession(sessao.id, {
      estado_atual: "conversa_encerrada",
      carrinho: [],
      contexto: {},
    });
    return "Conversa encerrada. Digite *menu* quando quiser fazer um novo pedido.";
  }

  // Trigger de menu reinicia fluxo
  if (isMenuTrigger(t) || sessao.estado_atual === "aguardando_inicio" || sessao.estado_atual === "conversa_encerrada") {
    const empresa = await getCompanyName(companyId);
    const { reply: catsReply, ctx } = await mostrarCategorias(companyId);
    await updateSession(sessao.id, {
      estado_atual: "escolhendo_categoria",
      contexto: ctx,
      carrinho: sessao.estado_atual === "conversa_encerrada" ? [] : sessao.carrinho,
    });
    return `Olá! Seja bem-vindo a *${empresa}* 🍔\n\n${catsReply}`;
  }

  // Máquina de estados
  switch (sessao.estado_atual) {
    case "escolhendo_categoria": {
      const ids: string[] = sessao.contexto?.categorias_ids ?? [];
      const n = parseInt(tl, 10);
      if (!Number.isFinite(n) || n < 1 || n > ids.length) {
        return "Opção inválida. Digite o *número* da categoria.";
      }
      const catId = ids[n - 1];
      const { reply, ctx } = await mostrarProdutos(companyId, catId);
      await updateSession(sessao.id, {
        estado_atual: "escolhendo_produto",
        contexto: { ...ctx, categoria_id: catId },
      });
      return reply;
    }

    case "escolhendo_produto": {
      if (tl === "0") {
        const { reply, ctx } = await mostrarCategorias(companyId);
        await updateSession(sessao.id, { estado_atual: "escolhendo_categoria", contexto: ctx });
        return reply;
      }
      const prods: { id: string; nome: string; preco: number }[] = sessao.contexto?.produtos ?? [];
      const n = parseInt(tl, 10);
      if (!Number.isFinite(n) || n < 1 || n > prods.length) {
        return "Opção inválida. Digite o *número* do produto ou *0* para voltar.";
      }
      const prod = prods[n - 1];
      await updateSession(sessao.id, {
        estado_atual: "escolhendo_quantidade",
        contexto: { ...sessao.contexto, produto_selecionado: prod },
      });
      return `Você escolheu *${prod.nome}* (${brl(prod.preco)}).\n\nQuantas unidades? (digite o número)`;
    }

    case "escolhendo_quantidade": {
      const n = parseInt(tl, 10);
      if (!Number.isFinite(n) || n < 1 || n > 99) {
        return "Quantidade inválida. Digite um número entre 1 e 99.";
      }
      const prod = sessao.contexto?.produto_selecionado;
      if (!prod) {
        await updateSession(sessao.id, { estado_atual: "aguardando_inicio" });
        return "Algo deu errado. Digite *menu* para recomeçar.";
      }
      await updateSession(sessao.id, {
        estado_atual: "escrevendo_observacao",
        contexto: { ...sessao.contexto, quantidade: n },
      });
      return `Alguma observação para esse item? (ex: sem cebola)\n\nDigite *pular* se não tiver.`;
    }

    case "escrevendo_observacao": {
      const prod = sessao.contexto?.produto_selecionado;
      const qty = sessao.contexto?.quantidade ?? 1;
      if (!prod) {
        await updateSession(sessao.id, { estado_atual: "aguardando_inicio" });
        return "Algo deu errado. Digite *menu* para recomeçar.";
      }
      const obs = ["pular", "nao", "não", "-"].includes(tl) ? undefined : t;
      const novoCarrinho: CartItem[] = [
        ...sessao.carrinho,
        { produto_id: prod.id, nome: prod.nome, preco: prod.preco, quantidade: qty, observacao: obs },
      ];
      await updateSession(sessao.id, {
        estado_atual: "confirmando_pedido",
        carrinho: novoCarrinho,
        contexto: {},
      });
      return `Item adicionado! 🛒\n\n${cartSummary(novoCarrinho)}\n\nO que deseja fazer?\n*1* — Adicionar mais itens\n*2* — Finalizar pedido\n*3* — Cancelar`;
    }

    case "confirmando_pedido": {
      if (tl === "1" || tl.includes("adicionar")) {
        const { reply, ctx } = await mostrarCategorias(companyId);
        await updateSession(sessao.id, { estado_atual: "escolhendo_categoria", contexto: ctx });
        return reply;
      }
      if (tl === "2" || ["finalizar", "fechar", "sim"].includes(tl)) {
        await updateSession(sessao.id, { estado_atual: "escolhendo_pagamento" });
        return `*Forma de pagamento:*\n\n*1* — Dinheiro\n*2* — PIX\n*3* — Cartão na entrega`;
      }
      if (tl === "3" || tl === "cancelar") {
        await updateSession(sessao.id, { estado_atual: "conversa_encerrada", carrinho: [], contexto: {} });
        return "Pedido cancelado. Digite *menu* quando quiser recomeçar.";
      }
      return "Opção inválida. Digite *1*, *2* ou *3*.";
    }

    case "escolhendo_pagamento": {
      const map: Record<string, string> = { "1": "Dinheiro", "2": "PIX", "3": "Cartão na entrega" };
      const pag = map[tl];
      if (!pag) return "Opção inválida. Digite *1*, *2* ou *3*.";
      try {
        const pedidoId = await finalizarPedido({
          ...sessao,
          contexto: { ...sessao.contexto, pagamento: pag },
        });
        const fluxo = await getFluxo(companyId);
        const total = cartTotal(sessao.carrinho);
        await updateSession(sessao.id, {
          estado_atual: "pedido_finalizado",
          carrinho: [],
          contexto: { pedido_id: pedidoId },
        });
        return `✅ *Pedido confirmado!*\n\nNº ${pedidoId.slice(0, 8).toUpperCase()}\nPagamento: ${pag}\nTotal: *${brl(total)}*\n\nTempo estimado: 35 minutos.\n\n${fluxo.mensagem_fechamento}`;
      } catch (e: any) {
        console.error("[whatsapp-engine] finalizar erro:", e?.message);
        return "Não conseguimos registrar seu pedido agora. Um atendente vai te chamar.";
      }
    }

    case "pedido_finalizado": {
      if (isMenuTrigger(t)) {
        const { reply, ctx } = await mostrarCategorias(companyId);
        await updateSession(sessao.id, { estado_atual: "escolhendo_categoria", contexto: ctx, carrinho: [] });
        return reply;
      }
      return "Seu pedido já está em preparo 🍽️\nDigite *menu* para fazer um novo pedido ou *atendente* para falar com alguém.";
    }

    case "aguardando_atendente":
      return null; // não responder automaticamente

    default: {
      await updateSession(sessao.id, { estado_atual: "aguardando_inicio" });
      return "Digite *menu* para começar.";
    }
  }
}

/**
 * Atendente envia mensagem manualmente — útil em handoff.
 */
export async function sendManualMessage(opts: {
  companyId: string;
  sessaoId: string;
  body: string;
}) {
  const { data: sessao } = await supabaseAdmin
    .from("whatsapp_sessoes")
    .select("*, conexao:whatsapp_conexoes(access_token, phone_number_id)")
    .eq("id", opts.sessaoId)
    .eq("company_id", opts.companyId)
    .maybeSingle();

  if (!sessao) throw new Error("Sessão não encontrada");

  const token = (sessao.conexao as any)?.access_token ?? process.env.WHATSAPP_META_TOKEN;
  const phoneNumberId = (sessao.conexao as any)?.phone_number_id ?? process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error("Conexão WhatsApp não configurada");
  }

  const res = await sendWhatsappCloud({
    phoneNumberId,
    to: sessao.customer_phone as string,
    body: opts.body,
    token,
  });

  // persiste em whatsapp_mensagens (conversa)
  const { data: conv } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select("id")
    .eq("company_id", opts.companyId)
    .eq("customer_phone", sessao.customer_phone)
    .maybeSingle();

  if (conv) {
    await supabaseAdmin.from("whatsapp_mensagens").insert({
      company_id: opts.companyId,
      conversa_id: conv.id,
      direction: "out",
      message_type: "text",
      content: opts.body,
      status: res.ok ? "sent" : "failed",
      raw_payload: res.raw,
    });
  }

  return res;
}
