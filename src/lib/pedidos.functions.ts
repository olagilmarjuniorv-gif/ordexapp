import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { audit } from "./audit.server";
import { getCaller } from "./auth.server";

export const PEDIDO_STATUSES = ["novo", "preparo", "pronto", "finalizado", "pago", "cancelado"] as const;
export const PEDIDO_CANAIS = ["salao", "balcao", "retirada", "delivery"] as const;
export const FASES_CANAL = [
  "aguardando_servir", "em_consumo",
  "aguardando_retirada", "retirado",
  "saiu_entrega", "entregue",
  "aguardando_cliente",
] as const;
export type FaseCanal = typeof FASES_CANAL[number];
export const FORMAS_PAGAMENTO = [
  "pix_online",
  "dinheiro",
  "credito_presencial",
  "debito_presencial",
  "pix_presencial",
  "pagamento_entrega",
  "pagamento_retirada",
] as const;
export const STATUS_FINANCEIRO = [
  "aguardando_pagamento",
  "pago",
  "pagamento_entrega",
  "pagamento_retirada",
  "cancelado",
] as const;
export type PedidoStatus = typeof PEDIDO_STATUSES[number];
export type FormaPagamento = typeof FORMAS_PAGAMENTO[number];
export type StatusFinanceiro = typeof STATUS_FINANCEIRO[number];

const adicionalSchema = z.object({
  name: z.string(),
  price: z.number().min(0),
});

const pedidoItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  combo_id: z.string().uuid().optional(),
  kind: z.enum(["produto", "combo"]).default("produto"),
  name: z.string().optional(),
  quantity: z.number().min(1),
  price: z.number().min(0).optional(),
  observacao: z.string().optional(),
  adicionais: z.array(adicionalSchema).default([]),
});

const createSchema = z.object({
  client_id: z.string().uuid().nullable().optional(),
  mesa_id: z.string().uuid().nullable().optional(),
  canal: z.enum(PEDIDO_CANAIS).default("salao"),
  observacao: z.string().optional(),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO).nullable().optional(),
  status_financeiro: z.enum(STATUS_FINANCEIRO).optional(),
  items: z.array(pedidoItemSchema).min(1, "Adicione ao menos um item."),
});

export const listPedidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) return [];

    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .select("id, created_at, status, total_amount, canal, mesa_id, user_id, observacao, forma_pagamento, status_financeiro, fase_canal, items, paid_at, external_provider, external_order_id, imported_at, cliente:clientes(id, name, phone), mesa:mesas(numero)")
      .eq("company_id", caller.companyId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPedido = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Error("Not allowed");

    const { data: pedido, error } = await supabaseAdmin
      .from("pedidos")
      .select("*, cliente:clientes(id, name, phone, email, address)")
      .eq("id", data.id)
      .eq("company_id", caller.companyId)
      .single();

    if (error) throw new Error("Pedido não encontrado");
    return pedido;
  });

export const createPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Error("Not allowed");

    const productIds = data.items.filter((i) => i.kind === "produto" && i.product_id).map((i) => i.product_id!) as string[];
    const comboIds = data.items.filter((i) => i.kind === "combo" && i.combo_id).map((i) => i.combo_id!) as string[];

    const [{ data: produtos, error: prodErr }, { data: combos }] = await Promise.all([
      productIds.length
        ? supabaseAdmin.from("produtos").select("id, name, price").in("id", productIds).eq("company_id", caller.companyId)
        : Promise.resolve({ data: [] as any[], error: null as any }),
      comboIds.length
        ? supabaseAdmin.from("combos").select("id, name, price").in("id", comboIds).eq("company_id", caller.companyId)
        : Promise.resolve({ data: [] as any[], error: null as any }),
    ]);

    if (prodErr) throw new Error("Falha ao validar produtos");
    if (productIds.length && (!produtos || produtos.length !== new Set(productIds).size)) {
      throw new Error("Produto inválido");
    }

    const refMap = new Map<string, { price: number; name: string }>();
    (produtos ?? []).forEach((p: any) => refMap.set(p.id, { price: Number(p.price), name: p.name }));
    (combos ?? []).forEach((c: any) => refMap.set(c.id, { price: Number(c.price), name: c.name }));

    let total_amount = 0;
    const items = data.items.map((i) => {
      const refKey = (i.kind === "combo" ? i.combo_id : i.product_id)!;
      const ref = refMap.get(refKey);
      if (!ref) throw new Error("Item inválido");
      const adicTotal = (i.adicionais ?? []).reduce((a, x) => a + Number(x.price ?? 0), 0);
      const price = (i.price ?? ref.price) + adicTotal;
      total_amount += i.quantity * price;
      return {
        kind: i.kind,
        product_id: i.product_id ?? null,
        combo_id: i.combo_id ?? null,
        name: ref.name,
        quantity: i.quantity,
        price,
        observacao: i.observacao ?? null,
        adicionais: i.adicionais ?? [],
      };
    });

    // Default financial status inferred from forma_pagamento
    let status_financeiro: StatusFinanceiro = data.status_financeiro ?? "aguardando_pagamento";
    if (!data.status_financeiro && data.forma_pagamento) {
      if (data.forma_pagamento === "pagamento_entrega") status_financeiro = "pagamento_entrega";
      else if (data.forma_pagamento === "pagamento_retirada") status_financeiro = "pagamento_retirada";
    }

    const { data: created, error: insErr } = await supabaseAdmin
      .from("pedidos")
      .insert({
        company_id: caller.companyId,
        user_id: caller.userId,
        client_id: data.client_id ?? null,
        mesa_id: data.mesa_id ?? null,
        canal: data.canal,
        observacao: data.observacao ?? null,
        items,
        total_amount,
        status: "novo",
        forma_pagamento: data.forma_pagamento ?? null,
        status_financeiro,
      } as any)
      .select("id")
      .single();

    if (insErr || !created) throw new Error(insErr?.message ?? "Erro ao criar pedido");

    if (data.mesa_id) {
      await supabaseAdmin
        .from("mesas")
        .update({ status: "ocupada", opened_at: new Date().toISOString() })
        .eq("id", data.mesa_id)
        .eq("company_id", caller.companyId)
        .eq("status", "livre");
    }

    await audit({
      companyId: caller.companyId,
      userId: caller.userId,
      action: "pedido.create",
      entityType: "pedido",
      entityId: created.id,
      description: `Pedido criado (${data.canal}) — ${formatBRL(total_amount)}`,
      metadata: { canal: data.canal, total: total_amount, mesa_id: data.mesa_id ?? null },
    });

    return { id: created.id };
  });

// Helper: if a mesa has no more active orders (active = não finalizado/pago/cancelado),
// libera a mesa automaticamente.
async function maybeLiberarMesa(companyId: string, mesaId: string | null | undefined) {
  if (!mesaId) return;
  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .select("id")
    .eq("company_id", companyId)
    .eq("mesa_id", mesaId)
    .not("status", "in", "(finalizado,pago,cancelado)")
    .limit(1);
  if (error) return;
  if ((data ?? []).length === 0) {
    await supabaseAdmin
      .from("mesas")
      .update({ status: "livre", opened_at: null })
      .eq("id", mesaId)
      .eq("company_id", companyId);
  }
}

export const updatePedidoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(PEDIDO_STATUSES) }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Error("Not allowed");

    // Carrega estado atual para regras automáticas
    const { data: current, error: loadErr } = await supabaseAdmin
      .from("pedidos")
      .select("status, status_financeiro, mesa_id")
      .eq("id", data.id)
      .eq("company_id", caller.companyId)
      .single();
    if (loadErr || !current) throw new Error("Pedido não encontrado");

    let finalStatus: PedidoStatus = data.status;
    // Normaliza legado: status=pago → finalizado + financeiro=pago
    if (data.status === "pago") {
      finalStatus = "finalizado";
    }

    const patch: Record<string, unknown> = { status: finalStatus };
    // Normaliza financeiro conforme transição
    if (data.status === "pago") {
      patch.status_financeiro = "pago";
      patch.paid_at = new Date().toISOString();
    } else if (data.status === "cancelado") {
      patch.status_financeiro = "cancelado";
    } else if (finalStatus === "finalizado") {
      // C2: regra de consistência financeira ao finalizar
      const fin = current.status_financeiro as StatusFinanceiro;
      if (fin === "pago") {
        if (!(current as any).paid_at) patch.paid_at = new Date().toISOString();
      } else if (fin === "pagamento_entrega" || fin === "pagamento_retirada") {
        patch.status_financeiro = "pago";
        patch.paid_at = new Date().toISOString();
      } else {
        throw new Error("Não é possível finalizar: marque o pagamento antes.");
      }
    }

    const { error } = await supabaseAdmin
      .from("pedidos")
      .update(patch as any)
      .eq("id", data.id)
      .eq("company_id", caller.companyId);

    if (error) throw new Error(error.message);

    // Auto-libera mesa se pedido virou terminal
    if (["finalizado", "pago", "cancelado"].includes(finalStatus)) {
      await maybeLiberarMesa(caller.companyId, current.mesa_id);
    }

    await audit({
      companyId: caller.companyId,
      userId: caller.userId,
      action: `pedido.${finalStatus}`,
      entityType: "pedido",
      entityId: data.id,
      description: `Status alterado para "${finalStatus}"`,
    });

    return { ok: true, status: finalStatus };
  });

// Voltar pedido para a cozinha (de "pronto" → "preparo"). Para erros operacionais.
export const voltarParaCozinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Error("Not allowed");
    if (!caller.isAdmin && caller.role !== "atendente") {
      throw new Error("Acesso negado");
    }
    const { error } = await supabaseAdmin
      .from("pedidos")
      .update({ status: "preparo", fase_canal: null } as any)
      .eq("id", data.id)
      .eq("company_id", caller.companyId)
      .in("status", ["pronto", "finalizado"]);
    if (error) throw new Error(error.message);
    await audit({
      companyId: caller.companyId,
      userId: caller.userId,
      action: "pedido.voltar_cozinha",
      entityType: "pedido",
      entityId: data.id,
      description: "Pedido devolvido à cozinha",
    });
    return { ok: true };
  });

// Atualiza sub-fase do canal (expedição). Opcionalmente marca pedido como finalizado.
export const setFaseCanal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      fase: z.enum(FASES_CANAL).nullable(),
      finalizar: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Error("Not allowed");

    const { data: current } = await supabaseAdmin
      .from("pedidos")
      .select("mesa_id, status_financeiro")
      .eq("id", data.id)
      .eq("company_id", caller.companyId)
      .single();
    if (!current) throw new Error("Pedido não encontrado");

    const patch: Record<string, unknown> = { fase_canal: data.fase };
    if (data.finalizar) {
      const fin = current.status_financeiro as StatusFinanceiro;
      if (fin === "pago") {
        patch.status = "finalizado";
        patch.paid_at = new Date().toISOString();
      } else if (fin === "pagamento_entrega" || fin === "pagamento_retirada") {
        patch.status = "finalizado";
        patch.status_financeiro = "pago";
        patch.paid_at = new Date().toISOString();
      } else {
        throw new Error(
          "Não é possível finalizar: marque o pagamento antes.",
        );
      }
    }
    const { error } = await supabaseAdmin
      .from("pedidos")
      .update(patch as any)
      .eq("id", data.id)
      .eq("company_id", caller.companyId);
    if (error) throw new Error(error.message);

    if (data.finalizar) {
      await maybeLiberarMesa(caller.companyId, current.mesa_id);
    }

    return { ok: true };
  });

export const updatePedidoStatusFinanceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status_financeiro: z.enum(STATUS_FINANCEIRO),
        forma_pagamento: z.enum(FORMAS_PAGAMENTO).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Error("Not allowed");
    if (!caller.isAdmin && caller.role !== "atendente") {
      throw new Error("Acesso negado");
    }

    const { data: current } = await supabaseAdmin
      .from("pedidos")
      .select("status, mesa_id")
      .eq("id", data.id)
      .eq("company_id", caller.companyId)
      .single();

    const patch: Record<string, unknown> = { status_financeiro: data.status_financeiro };
    if (data.forma_pagamento !== undefined) patch.forma_pagamento = data.forma_pagamento;
    if (data.status_financeiro === "pago") patch.paid_at = new Date().toISOString();

    // Regra: se pedido está "pronto" e foi marcado como pago → finalizado automático
    let autoFinalized = false;
    if (data.status_financeiro === "pago" && current?.status === "pronto") {
      patch.status = "finalizado";
      autoFinalized = true;
    }

    const { error } = await supabaseAdmin
      .from("pedidos")
      .update(patch as any)
      .eq("id", data.id)
      .eq("company_id", caller.companyId);

    if (error) throw new Error(error.message);

    if (autoFinalized) {
      await maybeLiberarMesa(caller.companyId, current?.mesa_id);
    }

    await audit({
      companyId: caller.companyId,
      userId: caller.userId,
      action: `pedido.financeiro.${data.status_financeiro}`,
      entityType: "pedido",
      entityId: data.id,
      description: `Status financeiro alterado para "${data.status_financeiro}"`,
    });

    return { ok: true };
  });

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
