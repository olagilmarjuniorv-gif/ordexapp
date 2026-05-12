import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["super_admin", "admin", "atendente"] as const;
const COMPANY_ROLES = ["admin", "atendente"] as const;
export type AppRole = (typeof ROLES)[number];

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

function assertAdminish(c: Caller) {
  if (!c.isSuperAdmin && !c.isCompanyAdmin) {
    throw new Response("Acesso negado", { status: 403 });
  }
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    assertAdminish(c);

    let q = supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, active, created_at, company_id, username")
      .order("created_at", { ascending: false });

    if (!c.isSuperAdmin) {
      if (!c.companyId) return [];
      q = q.eq("company_id", c.companyId);
    }

    const { data: profiles, error: pErr } = await q;
    if (pErr) throw new Response(pErr.message, { status: 500 });

    const ids = (profiles ?? []).map((p) => p.id);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const { data: companies } = await supabaseAdmin
      .from("companies")
      .select("id, name");
    const companyMap = new Map((companies ?? []).map((x) => [x.id, x.name]));

    return (profiles ?? []).map((p: any) => {
      const role = roles?.find((r) => r.user_id === p.id)?.role as AppRole | undefined;
      return {
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        active: p.active,
        username: (p.username as string | null) ?? null,
        role: role ?? null,
        company_id: p.company_id as string | null,
        company_name: p.company_id ? companyMap.get(p.company_id) ?? null : null,
      };
    });
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(1).max(120),
        username: z
          .string()
          .trim()
          .min(3)
          .max(32)
          .regex(/^[a-zA-Z0-9._-]+$/, "Username inválido"),
        password: z.string().min(6).max(128),
        role: z.enum(ROLES),
        company_id: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    assertAdminish(c);

    let companyId: string | null = data.company_id ?? null;
    let role: AppRole = data.role;

    if (c.isSuperAdmin) {
      if (role === "super_admin") companyId = null;
      else if (!companyId) throw new Response("Empresa é obrigatória", { status: 400 });
    } else {
      if (role === "super_admin") throw new Response("Sem permissão", { status: 403 });
      if (!c.companyId) throw new Response("Sua conta não está vinculada a uma empresa", { status: 400 });
      companyId = c.companyId;
      if (!COMPANY_ROLES.includes(role as (typeof COMPANY_ROLES)[number])) {
        throw new Response("Função inválida", { status: 400 });
      }
    }

    const username = data.username.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (existing) throw new Response("Usuário já existe", { status: 400 });

    const syntheticEmail = `${username}@ordex.local`;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, username },
    });
    if (error) throw new Response(error.message, { status: 400 });
    const uid = created.user!.id;
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name, company_id: companyId, username })
      .eq("id", uid);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role });
    if (rErr) throw new Response(rErr.message, { status: 500 });
    return { id: uid };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    assertAdminish(c);
    if (!c.isSuperAdmin) {
      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", data.user_id)
        .maybeSingle();
      if (!target || target.company_id !== c.companyId) {
        throw new Response("Acesso negado", { status: 403 });
      }
    }
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.user_id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid(), role: z.enum(ROLES) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    assertAdminish(c);

    if (!c.isSuperAdmin) {
      if (data.role === "super_admin") throw new Response("Sem permissão", { status: 403 });
      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", data.user_id)
        .maybeSingle();
      if (!target || target.company_id !== c.companyId) {
        throw new Response("Acesso negado", { status: 403 });
      }
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

// Bootstrap: if no super_admin exists, promote current user to super_admin.
// Mantido apenas para projetos novos. Será removido na Fase D após o primeiro super_admin existir.
export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (error) throw new Response(error.message, { status: 500 });
    if ((count ?? 0) > 0) return { promoted: false };
    await supabaseAdmin.from("user_roles").delete().eq("user_id", context.userId);
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "super_admin" });
    if (insErr) throw new Response(insErr.message, { status: 500 });
    return { promoted: true };
  });
