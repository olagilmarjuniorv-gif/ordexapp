import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

export const listCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    let q = supabaseAdmin
      .from("companies")
      .select("id, name, slug, phone, active, created_at")
      .order("name");

    if (!c.isSuperAdmin) {
      if (!c.companyId) return [];
      q = q.eq("id", c.companyId);
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
    const c = await getCaller(context.userId);
    if (!c.isSuperAdmin) {
      throw new Response("Acesso negado", { status: 403 });
    }
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
    const c = await getCaller(context.userId);
    if (!c.isSuperAdmin && !(c.isCompanyAdmin && c.companyId === data.id)) {
      throw new Response("Acesso negado", { status: 403 });
    }
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
    const c = await getCaller(context.userId);
    if (!c.isSuperAdmin) {
      throw new Response("Acesso negado", { status: 403 });
    }
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
