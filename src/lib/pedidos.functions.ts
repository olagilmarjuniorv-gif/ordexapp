
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AppRole } from "./users.functions";

// Helper to get user's context
type Caller = {
  userId: string;
  role: AppRole | null;
  companyId: string | null;
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
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
    isCompanyAdmin: role === "admin",
  };
}

export const listPedidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) return [];

    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .select("id, created_at, status, total_amount, cliente:clientes(id, name)")
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

export const createPedidoFromOrcamento = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d: unknown) => z.object({ orcamento_id: z.string().uuid() }).parse(d))
    .handler(async ({ context, data }) => {
        const caller = await getCaller(context.userId);
        if (!caller.companyId) throw new Response("Not allowed", { status: 403 });

        // 1. Get the orcamento
        const { data: orcamento, error: orcamentoError } = await supabaseAdmin
            .from("orcamentos")
            .select("*")
            .eq("id", data.orcamento_id)
            .eq("company_id", caller.companyId)
            .single();
        
        if (orcamentoError || !orcamento) throw new Response("Orçamento não encontrado", { status: 404 });
        if (orcamento.status !== 'sent') throw new Response(`Orçamento com status \"${orcamento.status}\" não pode ser aprovado.`, { status: 400 });

        // 2. Insert pedido directly (RPC for stock update will be added later)
        const { data: newPedido, error: insErr } = await supabaseAdmin
            .from("pedidos")
            .insert({
                company_id: caller.companyId,
                user_id: caller.userId,
                client_id: orcamento.client_id,
                orcamento_id: orcamento.id,
                total_amount: orcamento.total_amount,
                items: orcamento.items,
                status: 'pending',
            })
            .select("id")
            .single();

        if (insErr || !newPedido) throw new Response(insErr?.message ?? "Erro ao criar pedido", { status: 500 });

        // 3. Update orcamento status to 'approved'
        await supabaseAdmin.from("orcamentos").update({ status: 'approved' }).eq("id", orcamento.id);

        return { id: newPedido.id };
    });

export const updatePedidoStatus = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["pending", "processing", "completed", "cancelled"]) }).parse(d))
    .handler(async ({ context, data }) => {
        const caller = await getCaller(context.userId);
        if (!caller.companyId) throw new Response("Not allowed", { status: 403 });

        const { error } = await supabaseAdmin
            .from("pedidos")
            .update({ status: data.status })
            .eq("id", data.id)
            .eq("company_id", caller.companyId);

        if (error) throw new Response(error.message, { status: 500 });
        return { ok: true };
    });
