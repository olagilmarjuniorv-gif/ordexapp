import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const MESA_STATUSES = ["livre", "ocupada", "conta"] as const;
export type MesaStatus = typeof MESA_STATUSES[number];

async function getCompanyId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  return (data?.company_id as string | null) ?? null;
}

export const listMesas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await getCompanyId(context.userId);
    if (!companyId) return [];
    const { data, error } = await supabaseAdmin
      .from("mesas")
      .select("id, numero, status, capacidade, opened_at")
      .eq("company_id", companyId)
      .order("numero", { ascending: true });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const createMesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      numero: z.string().trim().min(1),
      capacidade: z.number().int().min(1).max(50).default(4),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const companyId = await getCompanyId(context.userId);
    if (!companyId) throw new Response("Sem empresa", { status: 403 });
    const { data: created, error } = await supabaseAdmin
      .from("mesas")
      .insert({ company_id: companyId, numero: data.numero, capacidade: data.capacidade })
      .select("id")
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { id: created.id };
  });

export const updateMesaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(MESA_STATUSES) }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const companyId = await getCompanyId(context.userId);
    if (!companyId) throw new Response("Sem empresa", { status: 403 });
    const patch: { status: MesaStatus; opened_at?: string | null } = { status: data.status };
    if (data.status === "ocupada") patch.opened_at = new Date().toISOString();
    if (data.status === "livre") patch.opened_at = null;
    const { error } = await supabaseAdmin
      .from("mesas")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const deleteMesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const companyId = await getCompanyId(context.userId);
    if (!companyId) throw new Response("Sem empresa", { status: 403 });
    const { error } = await supabaseAdmin
      .from("mesas")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
