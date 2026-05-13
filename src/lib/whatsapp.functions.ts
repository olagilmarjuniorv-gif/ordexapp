import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchWhatsapp, persistMessage, templateForStatus } from "./whatsapp.server";

async function getCaller(userId: string) {
  const [{ data: r }, { data: p }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
  ]);
  const role = (r?.role as string | undefined) ?? null;
  return {
    role,
    companyId: (p?.company_id as string | null) ?? null,
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "admin",
  };
}

export const listMensagens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(100) }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isSuperAdmin && !c.isAdmin) throw new Response("Acesso negado", { status: 403 });

    let q = supabaseAdmin
      .from("mensagens")
      .select("id, company_id, cliente_id, pedido_id, direction, body, status, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (!c.isSuperAdmin) {
      if (!c.companyId) return [];
      q = q.eq("company_id", c.companyId);
    }
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

export const sendWhatsappMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid().optional(),
        phone: z.string().optional(),
        body: z.string().min(1),
        pedido_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.companyId) throw new Response("Sem empresa", { status: 403 });

    let phone = data.phone ?? null;
    if (!phone && data.cliente_id) {
      const { data: cli } = await supabaseAdmin
        .from("clientes")
        .select("phone")
        .eq("id", data.cliente_id)
        .eq("company_id", c.companyId)
        .maybeSingle();
      phone = (cli?.phone as string) ?? null;
    }
    if (!phone) throw new Response("Telefone não encontrado", { status: 400 });

    const res = await dispatchWhatsapp(phone, data.body);
    await persistMessage({
      company_id: c.companyId,
      cliente_id: data.cliente_id ?? null,
      pedido_id: data.pedido_id ?? null,
      direction: "out",
      body: data.body,
      status: res.status,
      raw_payload: res.raw,
    });
    return { ok: res.ok, mocked: res.mocked };
  });

export const notifyPedidoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ pedido_id: z.string().uuid(), status: z.string() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.companyId) throw new Response("Sem empresa", { status: 403 });

    const { data: pedido } = await supabaseAdmin
      .from("pedidos")
      .select("id, company_id, total_amount, mesa_id, client_id")
      .eq("id", data.pedido_id)
      .eq("company_id", c.companyId)
      .maybeSingle();
    if (!pedido) throw new Response("Pedido não encontrado", { status: 404 });

    let clientePhone: string | null = null;
    let clienteName: string | undefined;
    if (pedido.client_id) {
      const { data: cli } = await supabaseAdmin
        .from("clientes")
        .select("phone, name")
        .eq("id", pedido.client_id as string)
        .maybeSingle();
      clientePhone = (cli?.phone as string) ?? null;
      clienteName = (cli?.name as string) ?? undefined;
    }
    let mesa: string | undefined;
    if (pedido.mesa_id) {
      const { data: m } = await supabaseAdmin
        .from("mesas")
        .select("numero")
        .eq("id", pedido.mesa_id as string)
        .maybeSingle();
      mesa = (m?.numero as string) ?? undefined;
    }

    const body = templateForStatus(data.status, {
      clienteName,
      mesa,
      total: Number(pedido.total_amount),
    });
    if (!body) return { ok: false, skipped: true };
    if (!clientePhone) return { ok: false, skipped: true, reason: "no_phone" };

    const res = await dispatchWhatsapp(clientePhone, body);
    await persistMessage({
      company_id: c.companyId,
      cliente_id: (pedido.client_id as string) ?? null,
      pedido_id: pedido.id as string,
      direction: "out",
      body,
      status: res.status,
      raw_payload: res.raw,
    });
    return { ok: res.ok, mocked: res.mocked };
  });
