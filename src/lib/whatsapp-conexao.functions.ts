import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller, assertCompanyScope } from "./auth.server";
import { pingMetaPhoneNumber } from "./whatsapp.server";

export const getWhatsappConexao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    if (!c.companyId) return null;
    const { data } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select(
        "id, status, phone_number, phone_number_id, whatsapp_business_id, active, connected_at, last_sync_at, last_error, created_at",
      )
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
    if (!c.companyId) {
      return { messagesToday: 0, conversations: 0, conversationsToday: 0, lastInboundAt: null as string | null };
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();

    const [msgsToday, convs, convsToday, lastInbound] = await Promise.all([
      supabaseAdmin
        .from("whatsapp_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("company_id", c.companyId)
        .gte("created_at", startIso),
      supabaseAdmin
        .from("whatsapp_conversas")
        .select("id", { count: "exact", head: true })
        .eq("company_id", c.companyId),
      supabaseAdmin
        .from("whatsapp_conversas")
        .select("id", { count: "exact", head: true })
        .eq("company_id", c.companyId)
        .gte("last_message_at", startIso),
      supabaseAdmin
        .from("whatsapp_mensagens")
        .select("created_at, content")
        .eq("company_id", c.companyId)
        .eq("direction", "in")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      messagesToday: msgsToday.count ?? 0,
      conversations: convs.count ?? 0,
      conversationsToday: convsToday.count ?? 0,
      lastInboundAt: (lastInbound.data?.created_at as string) ?? null,
      lastInboundPreview: (lastInbound.data?.content as string)?.slice(0, 120) ?? null,
    };
  });

export const connectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        phone_number: z.string().min(8).max(20),
        phone_number_id: z.string().min(1).max(64).optional(),
        whatsapp_business_id: z.string().min(1).max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });
    const companyId = assertCompanyScope(c);

    const phoneNumberId = data.phone_number_id ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? null;
    const wabaId = data.whatsapp_business_id ?? process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? null;

    const { data: existing } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("id")
      .eq("company_id", companyId)
      .maybeSingle();

    const payload = {
      company_id: companyId,
      status: "conectado" as const,
      phone_number: data.phone_number,
      phone_number_id: phoneNumberId,
      whatsapp_business_id: wabaId,
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
    const { error } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true, synced: 0 };
  });

/**
 * Testa a conexão chamando Meta Graph API.
 * Usa token da env (server-only) e phone_number_id da conexão.
 */
export const testWhatsappConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });
    const companyId = assertCompanyScope(c);

    const { data: conn } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("id, phone_number_id, access_token")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!conn) throw new Response("Conexão não encontrada", { status: 404 });

    const phoneNumberId = (conn.phone_number_id as string) ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = (conn.access_token as string) ?? process.env.WHATSAPP_META_TOKEN;
    if (!phoneNumberId || !token) {
      return { ok: false, error: "Token ou Phone Number ID não configurado" };
    }

    const r = await pingMetaPhoneNumber({ phoneNumberId, token });
    await supabaseAdmin
      .from("whatsapp_conexoes")
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: r.ok ? null : (r.error ?? "ping failed").slice(0, 300),
        status: r.ok ? "conectado" : "erro",
      })
      .eq("id", conn.id);

    return {
      ok: r.ok,
      display_phone_number: r.display_phone_number,
      verified_name: r.verified_name,
      error: r.error,
    };
  });
