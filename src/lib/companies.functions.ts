import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Response("Acesso negado", { status: 403 });
}

export const listCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Super admins see all; regular users see their own
    const { data: r } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    const isSuper = r?.role === "super_admin";

    let q = supabaseAdmin
      .from("companies")
      .select("id, name, slug, phone, active, created_at")
      .order("name");
    if (!isSuper) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", context.userId)
        .maybeSingle();
      if (!p?.company_id) return [];
      q = q.eq("id", p.company_id);
    }
    const { data, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        slug: z.string().trim().max(60).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin
      .from("companies")
      .insert({
        name: data.name,
        slug: data.slug || null,
        phone: data.phone || null,
      })
      .select("id")
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { id: created.id };
  });

export const updateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        slug: z.string().trim().max(60).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ name: data.name, slug: data.slug || null, phone: data.phone || null })
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const setCompanyActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
