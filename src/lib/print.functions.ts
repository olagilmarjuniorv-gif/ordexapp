import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

async function loadCompanyAndAtendente(companyId: string, userId: string | null) {
  const [{ data: company }, { data: atendente }] = await Promise.all([
    supabaseAdmin.from("companies").select("name, phone").eq("id", companyId).maybeSingle(),
    userId
      ? supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    company: company ?? { name: "ORDEX", phone: null },
    atendenteName: (atendente?.full_name as string | undefined) ?? null,
  };
}

export const getPrintPedido = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Sem empresa", { status: 403 });

    const { data: pedido, error } = await supabaseAdmin
      .from("pedidos")
      .select("*, cliente:clientes(name, phone, address), mesa:mesas(numero)")
      .eq("id", data.id)
      .eq("company_id", caller.companyId)
      .single();
    if (error || !pedido) throw new Response("Pedido não encontrado", { status: 404 });

    const extra = await loadCompanyAndAtendente(caller.companyId, (pedido as any).user_id ?? null);
    return { pedido, ...extra };
  });

export const getPrintComanda = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mesaId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Sem empresa", { status: 403 });

    const { data: mesa, error: mErr } = await supabaseAdmin
      .from("mesas")
      .select("id, numero, opened_at, status")
      .eq("id", data.mesaId)
      .eq("company_id", caller.companyId)
      .single();
    if (mErr || !mesa) throw new Response("Mesa não encontrada", { status: 404 });

    const { data: pedidos } = await supabaseAdmin
      .from("pedidos")
      .select("id, created_at, status, total_amount, items, observacao")
      .eq("company_id", caller.companyId)
      .eq("mesa_id", data.mesaId)
      .neq("status", "cancelado")
      .order("created_at", { ascending: true });

    const extra = await loadCompanyAndAtendente(caller.companyId, context.userId);
    const total = (pedidos ?? []).reduce((s, p) => s + Number(p.total_amount), 0);
    return { mesa, pedidos: pedidos ?? [], total, ...extra };
  });
