import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getCompany(userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  return (data?.company_id as string | null) ?? null;
}

export const listCombos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const company = await getCompany(context.userId);
    if (!company) return [];
    const { data: combos, error } = await supabaseAdmin
      .from("combos")
      .select("id, name, description, price, active, image_url")
      .eq("company_id", company)
      .order("name");
    if (error) throw new Response(error.message, { status: 500 });
    if (!combos?.length) return [];
    const ids = combos.map((c) => c.id);
    const { data: itens } = await supabaseAdmin
      .from("combo_itens")
      .select("combo_id, produto_id, quantity, produto:produtos(id, name)")
      .in("combo_id", ids);
    return combos.map((c) => ({ ...c, itens: (itens ?? []).filter((i) => i.combo_id === c.id) }));
  });

export const upsertCombo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1),
      description: z.string().optional().nullable(),
      price: z.number().min(0),
      active: z.boolean().default(true),
      image_url: z.string().optional().nullable(),
      itens: z.array(z.object({ produto_id: z.string().uuid(), quantity: z.number().int().min(1) })).default([]),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    let id = data.id;
    if (id) {
      const { error } = await supabaseAdmin.from("combos")
        .update({ name: data.name, description: data.description, price: data.price, active: data.active, image_url: data.image_url })
        .eq("id", id).eq("company_id", company);
      if (error) throw new Response(error.message, { status: 500 });
    } else {
      const { data: c, error } = await supabaseAdmin.from("combos")
        .insert({ name: data.name, description: data.description, price: data.price, active: data.active, image_url: data.image_url, company_id: company })
        .select("id").single();
      if (error) throw new Response(error.message, { status: 500 });
      id = c.id;
    }
    await supabaseAdmin.from("combo_itens").delete().eq("combo_id", id);
    if (data.itens.length) {
      const rows = data.itens.map((i) => ({ combo_id: id!, produto_id: i.produto_id, quantity: i.quantity }));
      const { error } = await supabaseAdmin.from("combo_itens").insert(rows);
      if (error) throw new Response(error.message, { status: 500 });
    }
    return { id };
  });

export const deleteCombo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const company = await getCompany(context.userId);
    if (!company) throw new Response("Sem empresa", { status: 403 });
    await supabaseAdmin.from("combo_itens").delete().eq("combo_id", data.id);
    const { error } = await supabaseAdmin.from("combos").delete().eq("id", data.id).eq("company_id", company);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
