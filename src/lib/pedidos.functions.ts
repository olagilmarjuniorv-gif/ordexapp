import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
export const PEDIDO_CANAIS = ["salao", "balcao", "retirada", "delivery", "whatsapp"] as const;
export type PedidoStatus = typeof PEDIDO_STATUSES[number];

const pedidoItemSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().optional(),
  quantity: z.number().min(1),
  price: z.number().min(0).optional(),
  observacao: z.string().optional(),
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
      .select("id, created_at, status, total_amount, canal, mesa_id, cliente:clientes(id, name)")
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

    const productIds = data.items.map((i) => i.product_id);
    const { data: produtos, error: prodErr } = await supabaseAdmin
      .from("produtos")
      .select("id, name, price")
      .in("id", productIds)
      .eq("company_id", caller.companyId);

    if (prodErr) throw new Response("Falha ao validar produtos", { status: 500 });
    if (!produtos || produtos.length !== new Set(productIds).size) {
      throw new Response("Produto inválido", { status: 400 });
    }

    const priceMap = new Map(produtos.map((p) => [p.id, { price: Number(p.price), name: p.name }]));
    let total_amount = 0;
    const items = data.items.map((i) => {
      const ref = priceMap.get(i.product_id)!;
      const price = i.price ?? ref.price;
      total_amount += i.quantity * price;
      return { product_id: i.product_id, name: ref.name, quantity: i.quantity, price, observacao: i.observacao ?? null };
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
    return { id: created.id };
  });

export const updatePedidoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(PEDIDO_STATUSES) }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Not allowed", { status: 403 });

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "pago") patch.paid_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("pedidos")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", caller.companyId);

    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
