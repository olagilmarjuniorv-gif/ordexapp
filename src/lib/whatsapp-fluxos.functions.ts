import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller, assertAdminish, assertTrialAtivo } from "./auth.server";

async function getCompany(userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  return (data?.company_id as string | null) ?? null;
}


export const getFluxo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const company = await getCompany(context.userId);
    if (!company) return null;
    const { data } = await supabaseAdmin
      .from("whatsapp_fluxos")
      .select("*")
      .eq("company_id", company)
      .maybeSingle();
    if (data) return data;
    const { data: created } = await supabaseAdmin
      .from("whatsapp_fluxos")
      .insert({ company_id: company })
      .select("*")
      .single();
    return created;
  });

export const upsertFluxo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      mensagem_boas_vindas: z.string().trim().min(1).max(1000),
      mensagem_fechamento: z.string().trim().min(1).max(1000),
      mensagem_sem_atendimento: z.string().trim().min(1).max(1000),
      ativo: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    await assertTrialAtivo(caller);
    assertAdminish(caller);
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });

    const { error } = await supabaseAdmin
      .from("whatsapp_fluxos")
      .upsert({ company_id: company, ...data }, { onConflict: "company_id" });
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
