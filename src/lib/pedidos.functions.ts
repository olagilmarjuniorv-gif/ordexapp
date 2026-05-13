import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { audit } from "./audit.server";
import type { AppRole } from "./users.functions";

type Caller = {
  userId: string;
  role: AppRole | null;
  companyId: string | null;
  isSuperAdmin: boolean;
};

async function getCaller(userId: string): Promise<Caller> {
  const [{ data: r }, { data: p }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
  ]);
  const role = (r?.role as AppRole | undefined) ?? null;
  return {
    userId,
    role,
    companyId: (p?.company_id as string | null) ?? null,
    isSuperAdmin: role === "super_admin",
  };
}

export const PEDIDO_STATUSES = ["novo", "preparo", "pronto", "pago", "cancelado"] as const;
export const PEDIDO_CANAIS = ["salao", "balcao", "retirada", "delivery"] as const;
export type PedidoStatus = typeof PEDIDO_STATUSES[number];

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
  items: z.array(pedidoItemSchema).min(1, "Adicione ao menos um item."),
});

export const listPedidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) return [];

    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .select("id, created_at, status, total_amount, canal, mesa_id, user_id, cliente:clientes(id, name), mesa:mesas(numero)")
      .eq("company_id", caller.companyId)
      .order("created_at", { ascending: false });

    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const getPedido = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Not allowed", { status: 403 });

    const { data: pedido, error } = await supabaseAdmin
      .from("pedidos")
      .select("*, cliente:clientes(id, name, phone, email, address)")
      .eq("id", data.id)
      .eq("company_id", caller.companyId)
      .single();

    if (error) throw new Response("Pedido não encontrado", { status: 404 });
    return pedido;
  });

export const createPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Not allowed", { status: 403 });

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

    if (prodErr) throw new Response("Falha ao validar produtos", { status: 500 });
    if (productIds.length && (!produtos || produtos.length !== new Set(productIds).size)) {
      throw new Response("Produto inválido", { status: 400 });
    }

    const refMap = new Map<string, { price: number; name: string }>();
    (produtos ?? []).forEach((p: any) => refMap.set(p.id, { price: Number(p.price), name: p.name }));
    (combos ?? []).forEach((c: any) => refMap.set(c.id, { price: Number(c.price), name: c.name }));

    let total_amount = 0;
    const items = data.items.map((i) => {
      const refKey = (i.kind === "combo" ? i.combo_id : i.product_id)!;
      const ref = refMap.get(refKey);
      if (!ref) throw new Response("Item inválido", { status: 400 });
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
      })
      .select("id")
      .single();

    if (insErr || !created) throw new Response(insErr?.message ?? "Erro ao criar pedido", { status: 500 });

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

export const updatePedidoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(PEDIDO_STATUSES) }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Not allowed", { status: 403 });

    const patch: { status: PedidoStatus; paid_at?: string } = { status: data.status };
    if (data.status === "pago") patch.paid_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("pedidos")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", caller.companyId);

    if (error) throw new Response(error.message, { status: 500 });

    await audit({
      companyId: caller.companyId,
      userId: caller.userId,
      action: `pedido.${data.status}`,
      entityType: "pedido",
      entityId: data.id,
      description: `Status alterado para "${data.status}"`,
    });

    return { ok: true };
  });

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
