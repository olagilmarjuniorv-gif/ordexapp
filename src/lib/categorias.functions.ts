import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getCompany(userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  return (data?.company_id as string | null) ?? null;
}

export const listCategorias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const company = await getCompany(context.userId);
    if (!company) return [];
    const { data, error } = await supabaseAdmin
      .from("categorias")
      .select("id, name, sort_order, active")
      .eq("company_id", company)
      .order("sort_order")
      .order("name");
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const upsertCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1),
      sort_order: z.number().int().default(0),
      active: z.boolean().default(true),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    if (data.id) {
      const { error } = await supabaseAdmin.from("categorias")
        .update({ name: data.name, sort_order: data.sort_order, active: data.active })
        .eq("id", data.id).eq("company_id", company);
      if (error) throw new Response(error.message, { status: 500 });
      return { id: data.id };
    }
    const { data: created, error } = await supabaseAdmin.from("categorias")
      .insert({ name: data.name, sort_order: data.sort_order, active: data.active, company_id: company })
      .select("id").single();
    if (error) throw new Response(error.message, { status: 500 });
    return { id: created.id };
  });

export const reorderCategorias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    await Promise.all(
      data.ids.map((id, idx) =>
        supabaseAdmin.from("categorias")
          .update({ sort_order: idx })
          .eq("id", id).eq("company_id", company)
      )
    );
    return { ok: true };
  });

export const deleteCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    const { error } = await supabaseAdmin.from("categorias").delete().eq("id", data.id).eq("company_id", company);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
