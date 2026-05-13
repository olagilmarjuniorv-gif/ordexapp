import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

export const listProdutos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const caller = await getCaller(context.userId);
    if (!caller.isSuperAdmin && !caller.companyId) return [];

    let query = supabaseAdmin
      .from("produtos")
      .select("id, name, description, price, active, available, image_url, category_id, stock");

    if (!caller.isSuperAdmin && caller.companyId) {
      query = query.eq("company_id", caller.companyId);
    }
    const { data, error } = await query.order("name");
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

const produtoSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  price: z.number().min(0),
  active: z.boolean().default(true),
  available: z.boolean().default(true),
  image_url: z.string().optional().nullable(),
  category_id: z.string().uuid().nullable().optional(),
  stock: z.number().min(0).default(0),
});

export const createProduto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => produtoSchema.parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Sem empresa", { status: 403 });
    const { data: created, error } = await supabaseAdmin
      .from("produtos")
      .insert({ ...data, company_id: caller.companyId })
      .select("id").single();
    if (error) throw new Response(error.message, { status: 400 });
    return { id: created.id };
  });

export const updateProduto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => produtoSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Sem empresa", { status: 403 });
    const { id, ...rest } = data;
    const { error } = await supabaseAdmin
      .from("produtos")
      .update(rest)
      .eq("id", id)
      .eq("company_id", caller.companyId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const setProdutoActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Sem empresa", { status: 403 });
    const { error } = await supabaseAdmin
      .from("produtos")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("company_id", caller.companyId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const setProdutoAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), available: z.boolean() }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Sem empresa", { status: 403 });
    const { error } = await supabaseAdmin
      .from("produtos")
      .update({ available: data.available })
      .eq("id", data.id)
      .eq("company_id", caller.companyId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

// Upload image — receives base64 dataURL or raw base64, returns public URL.
export const uploadProdutoImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      filename: z.string(),
      contentType: z.string(),
      dataBase64: z.string(),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("Sem empresa", { status: 403 });
    const cleaned = data.dataBase64.includes(",") ? data.dataBase64.split(",")[1] : data.dataBase64;
    const buf = Buffer.from(cleaned, "base64");
    const ext = (data.filename.split(".").pop() || "jpg").toLowerCase();
    const path = `${caller.companyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabaseAdmin.storage.from("produtos").upload(path, buf, {
      contentType: data.contentType, upsert: false,
    });
    if (error) throw new Response(error.message, { status: 500 });
    const { data: pub } = supabaseAdmin.storage.from("produtos").getPublicUrl(path);
    return { url: pub.publicUrl, path };
  });
