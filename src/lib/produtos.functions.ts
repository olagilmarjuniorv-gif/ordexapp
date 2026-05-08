
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AppRole } from "./users.functions";

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

export const listProdutos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const caller = await getCaller(context.userId);
    if (!caller.isSuperAdmin && !caller.companyId) {
      return [];
    }

    let query = supabaseAdmin.from("produtos").select("id, name, description, price, active");

    if (!caller.isSuperAdmin) {
      query = query.eq("company_id", caller.companyId);
    }

    const { data, error } = await query.order("name");
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const createProduto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
        name: z.string().trim().min(1),
        description: z.string().optional().nullable(),
        price: z.number().min(0),
        active: z.boolean().default(true),
      }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) {
      throw new Response("Usuário não está vinculado a uma empresa.", { status: 403 });
    }

    const { data: created, error } = await supabaseAdmin
      .from("produtos")
      .insert({
        ...data,
        company_id: caller.companyId,
      })
      .select("id")
      .single();

    if (error) throw new Response(error.message, { status: 400 });
    return { id: created.id };
  });

export const updateProduto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1),
        description: z.string().optional().nullable(),
        price: z.number().min(0),
        active: z.boolean(),
      }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) {
      throw new Response("Usuário não está vinculado a uma empresa.", { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("produtos")
      .update({
        name: data.name,
        description: data.description,
        price: data.price,
        active: data.active,
      })
      .eq("id", data.id)
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
    if (!caller.companyId) {
      throw new Response("Usuário não está vinculado a uma empresa.", { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("produtos")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("company_id", caller.companyId);

    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
