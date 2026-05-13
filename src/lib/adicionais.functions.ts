import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getCompany(userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  return (data?.company_id as string | null) ?? null;
}

export const listAdicionaisGrupos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const company = await getCompany(context.userId);
    if (!company) return [];
    const { data: grupos, error } = await supabaseAdmin
      .from("adicionais_grupos")
      .select("id, name, required, min_select, max_select")
      .eq("company_id", company)
      .order("name");
    if (error) throw new Response(error.message, { status: 500 });
    if (!grupos?.length) return [];
    const ids = grupos.map((g) => g.id);
    const { data: opcoes } = await supabaseAdmin
      .from("adicionais_opcoes")
      .select("id, grupo_id, name, price, active")
      .in("grupo_id", ids)
      .order("name");
    return grupos.map((g) => ({ ...g, opcoes: (opcoes ?? []).filter((o) => o.grupo_id === g.id) }));
  });

export const upsertAdicionalGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1),
      required: z.boolean().default(false),
      min_select: z.number().int().min(0).default(0),
      max_select: z.number().int().min(1).default(1),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    if (data.id) {
      const { error } = await supabaseAdmin.from("adicionais_grupos")
        .update({ name: data.name, required: data.required, min_select: data.min_select, max_select: data.max_select })
        .eq("id", data.id).eq("company_id", company);
      if (error) throw new Response(error.message, { status: 500 });
      return { id: data.id };
    }
    const { data: c, error } = await supabaseAdmin.from("adicionais_grupos")
      .insert({ ...data, company_id: company })
      .select("id").single();
    if (error) throw new Response(error.message, { status: 500 });
    return { id: c.id };
  });

export const deleteAdicionalGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    await supabaseAdmin.from("adicionais_opcoes").delete().eq("grupo_id", data.id);
    const { error } = await supabaseAdmin.from("adicionais_grupos").delete().eq("id", data.id).eq("company_id", company);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const upsertAdicionalOpcao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      grupo_id: z.string().uuid(),
      name: z.string().trim().min(1),
      price: z.number().min(0).default(0),
      active: z.boolean().default(true),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    const { data: g } = await supabaseAdmin.from("adicionais_grupos").select("company_id").eq("id", data.grupo_id).maybeSingle();
    if (!g || g.company_id !== company) throw new Response("Grupo inválido", { status: 403 });
    if (data.id) {
      const { error } = await supabaseAdmin.from("adicionais_opcoes")
        .update({ name: data.name, price: data.price, active: data.active })
        .eq("id", data.id);
      if (error) throw new Response(error.message, { status: 500 });
      return { id: data.id };
    }
    const { data: c, error } = await supabaseAdmin.from("adicionais_opcoes")
      .insert({ grupo_id: data.grupo_id, name: data.name, price: data.price, active: data.active })
      .select("id").single();
    if (error) throw new Response(error.message, { status: 500 });
    return { id: c.id };
  });

export const deleteAdicionalOpcao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    const { error } = await supabaseAdmin.from("adicionais_opcoes").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

// Vinculo produto -> grupos
export const setProdutoAdicionais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ produto_id: z.string().uuid(), grupo_ids: z.array(z.string().uuid()) }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    const { data: p } = await supabaseAdmin.from("produtos").select("company_id").eq("id", data.produto_id).maybeSingle();
    if (!p || p.company_id !== company) throw new Response("Produto inválido", { status: 403 });
    await supabaseAdmin.from("produto_grupos_adicionais").delete().eq("produto_id", data.produto_id);
    if (data.grupo_ids.length) {
      const rows = data.grupo_ids.map((grupo_id) => ({ produto_id: data.produto_id, grupo_id }));
      const { error } = await supabaseAdmin.from("produto_grupos_adicionais").insert(rows);
      if (error) throw new Response(error.message, { status: 500 });
    }
    return { ok: true };
  });

export const getProdutoAdicionais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ produto_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) return [];
    const { data: links } = await supabaseAdmin
      .from("produto_grupos_adicionais")
      .select("grupo_id")
      .eq("produto_id", data.produto_id);
    const ids = (links ?? []).map((l) => l.grupo_id);
    if (!ids.length) return [];
    const { data: grupos } = await supabaseAdmin
      .from("adicionais_grupos")
      .select("id, name, required, min_select, max_select")
      .in("id", ids)
      .eq("company_id", company);
    const { data: opcoes } = await supabaseAdmin
      .from("adicionais_opcoes")
      .select("id, grupo_id, name, price, active")
      .in("grupo_id", ids)
      .eq("active", true);
    return (grupos ?? []).map((g) => ({ ...g, opcoes: (opcoes ?? []).filter((o) => o.grupo_id === g.id) }));
  });
