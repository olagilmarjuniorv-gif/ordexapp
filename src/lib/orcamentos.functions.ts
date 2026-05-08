import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type CallerCtx = { userId: string; companyId: string | null };

async function getCaller(userId: string): Promise<CallerCtx> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  return { userId, companyId: (data?.company_id as string | null) ?? null };
}

const orcamentoItemSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().optional(),
  quantity: z.number().min(1),
  price: z.number().min(0).optional(),
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  client_id: z.string().uuid(),
  items: z.array(orcamentoItemSchema).min(1, "Adicione ao menos um item."),
});

const statusSchema = z.enum(["draft", "sent", "approved", "rejected"]);

export const listOrcamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) return [];

    const { data, error } = await supabaseAdmin
      .from("orcamentos")
      .select("id, status, total_amount, created_at, cliente:clientes(id, name, phone)")
      .eq("company_id", caller.companyId)
      .order("created_at", { ascending: false });

    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

// Backwards-compatible alias
export const getOrcamentos = listOrcamentos;

export const getOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Sem empresa", { status: 403 });

    const { data: orc, error } = await supabaseAdmin
      .from("orcamentos")
      .select("*, cliente:clientes(id, name, phone, email, address)")
      .eq("id", data.id)
      .eq("company_id", caller.companyId)
      .single();

    if (error) throw new Response("Orçamento não encontrado", { status: 404 });
    return orc;
  });

export const upsertOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Sem empresa", { status: 403 });

    // Validate products & compute prices server-side
    const productIds = data.items.map((i) => i.product_id);
    const { data: produtos, error: prodErr } = await supabaseAdmin
      .from("produtos")
      .select("id, name, price")
      .in("id", productIds)
      .eq("company_id", caller.companyId);

    if (prodErr) throw new Response("Falha ao validar produtos", { status: 500 });
    if (!produtos || produtos.length !== productIds.length) {
      throw new Response("Produto inválido", { status: 400 });
    }

    const priceMap = new Map(produtos.map((p) => [p.id, { price: Number(p.price), name: p.name }]));
    let total_amount = 0;
    const items = data.items.map((i) => {
      const ref = priceMap.get(i.product_id)!;
      const price = i.price ?? ref.price;
      total_amount += i.quantity * price;
      return { product_id: i.product_id, name: ref.name, quantity: i.quantity, price };
    });

    if (data.id) {
      // Only drafts can be edited
      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from("orcamentos")
        .select("status")
        .eq("id", data.id)
        .eq("company_id", caller.companyId)
        .maybeSingle();
      if (fetchErr || !existing) throw new Response("Orçamento não encontrado", { status: 404 });
      if (existing.status !== "draft") {
        throw new Response("Apenas rascunhos podem ser editados.", { status: 400 });
      }

      const { data: updated, error: updErr } = await supabaseAdmin
        .from("orcamentos")
        .update({ client_id: data.client_id, items, total_amount })
        .eq("id", data.id)
        .select("id")
        .single();
      if (updErr) throw new Response(updErr.message, { status: 500 });
      return { id: updated.id };
    }

    const { data: created, error: insErr } = await supabaseAdmin
      .from("orcamentos")
      .insert({
        company_id: caller.companyId,
        user_id: caller.userId,
        client_id: data.client_id,
        items,
        total_amount,
        status: "draft",
      })
      .select("id")
      .single();
    if (insErr) throw new Response(insErr.message, { status: 500 });
    return { id: created.id };
  });

export const updateOrcamentoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: statusSchema }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Sem empresa", { status: 403 });

    const { error } = await supabaseAdmin
      .from("orcamentos")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("company_id", caller.companyId);

    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
