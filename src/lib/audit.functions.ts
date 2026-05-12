import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        company_id: z.string().uuid().nullable().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isSuperAdmin && !c.isAdmin) {
      throw new Response("Acesso negado", { status: 403 });
    }
    let q = supabaseAdmin
      .from("audit_logs")
      .select("id, company_id, user_id, user_name, action, entity_type, entity_id, description, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (c.isSuperAdmin) {
      if (data.company_id) q = q.eq("company_id", data.company_id);
    } else {
      if (!c.companyId) return { logs: [], companies: [] };
      q = q.eq("company_id", c.companyId);
    }
    const { data: logs, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });

    let companies: { id: string; name: string }[] = [];
    if (c.isSuperAdmin) {
      const { data: cs } = await supabaseAdmin.from("companies").select("id, name").order("name");
      companies = (cs as any) ?? [];
    }
    return { logs: logs ?? [], companies };
  });

export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date().toISOString();
    await supabaseAdmin.from("profiles").update({ last_login_at: now }).eq("id", context.userId);
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("company_id, full_name, username")
      .eq("id", context.userId)
      .maybeSingle();
    await supabaseAdmin.from("audit_logs").insert({
      company_id: (p?.company_id as string | null) ?? null,
      user_id: context.userId,
      user_name: (p?.full_name as string) || (p?.username as string) || null,
      action: "login",
      entity_type: "auth",
      entity_id: context.userId,
      description: "Login realizado",
    });
    return { ok: true };
  });
