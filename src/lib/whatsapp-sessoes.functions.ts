import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendManualMessage } from "./whatsapp-engine.server";

async function getCompany(userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  return (data?.company_id as string | null) ?? null;
}

export const listSessoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const company = await getCompany(context.userId);
    if (!company) return [];
    const { data } = await supabaseAdmin
      .from("whatsapp_sessoes")
      .select("id, customer_phone, estado_atual, atendente_assumiu, last_event_at, carrinho")
      .eq("company_id", company)
      .order("last_event_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const assumirAtendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    const { error } = await supabaseAdmin
      .from("whatsapp_sessoes")
      .update({ atendente_assumiu: true, estado_atual: "aguardando_atendente" })
      .eq("id", data.id)
      .eq("company_id", company);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const liberarAtendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    const { error } = await supabaseAdmin
      .from("whatsapp_sessoes")
      .update({ atendente_assumiu: false, estado_atual: "aguardando_inicio" })
      .eq("id", data.id)
      .eq("company_id", company);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const enviarMensagemManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(1000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    const res = await sendManualMessage({ companyId: company, sessaoId: data.id, body: data.body });
    return { ok: res.ok, status: res.status };
  });
