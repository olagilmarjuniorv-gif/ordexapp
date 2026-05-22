import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller, assertCompanyScope } from "./auth.server";

export const getWhatsappConexao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    if (!c.companyId) return null;
    const { data } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("*")
      .eq("company_id", c.companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const getWhatsappStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    if (!c.companyId) return { messagesToday: 0, conversations: 0 };
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [{ count: msgs }, { count: convs }] = await Promise.all([
      supabaseAdmin
        .from("whatsapp_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("company_id", c.companyId)
        .gte("created_at", start.toISOString()),
      supabaseAdmin
        .from("whatsapp_conversas")
        .select("id", { count: "exact", head: true })
        .eq("company_id", c.companyId),
    ]);
    return { messagesToday: msgs ?? 0, conversations: convs ?? 0 };
  });

export const connectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        phone_number: z.string().min(8).max(20),
        whatsapp_business_id: z.string().min(1).max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });
    const companyId = assertCompanyScope(c);

    const { data: existing } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("id")
      .eq("company_id", companyId)
      .maybeSingle();

    const payload = {
      company_id: companyId,
      status: "conectado" as const,
      phone_number: data.phone_number,
      whatsapp_business_id: data.whatsapp_business_id ?? null,
      active: true,
      connected_at: new Date().toISOString(),
      last_error: null,
    };

    if (existing) {
      const { error } = await supabaseAdmin
        .from("whatsapp_conexoes")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Response(error.message, { status: 500 });
      return { id: existing.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return { id: ins.id };
  });

export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });
    const companyId = assertCompanyScope(c);
    const { error } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .update({ status: "desconectado", active: false })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const syncWhatsappNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });
    const companyId = assertCompanyScope(c);
    // Placeholder até integração oficial com Meta Cloud API
    const { error } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true, synced: 0 };
  });
