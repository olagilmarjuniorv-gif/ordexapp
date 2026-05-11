
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

export const listClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const caller = await getCaller(context.userId);

    if (!caller.isSuperAdmin && !caller.companyId) {
      return [];
    }

    let query = supabaseAdmin.from("clientes").select("id, name, email, phone, address");

    if (!caller.isSuperAdmin && caller.companyId) {
      query = query.eq("company_id", caller.companyId);
    }

    const { data, error } = await query.order("name");
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const createCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
        name: z.string().trim().min(1),
        email: z.string().email().optional().nullable(),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
      }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) {
        throw new Response("Usuário não está vinculado a uma empresa.", { status: 403 });
    }

    const { data: created, error } = await supabaseAdmin
      .from("clientes")
      .insert({
        ...data,
        company_id: caller.companyId, // Force company_id from server-side context
      })
      .select("id")
      .single();

    if (error) throw new Response(error.message, { status: 400 });
    return { id: created.id };
  });

export const updateCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1),
        email: z.string().email().optional().nullable(),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
      }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) {
        throw new Response("Usuário não está vinculado a uma empresa.", { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("clientes")
      .update({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
      })
      .eq("id", data.id)
      .eq("company_id", caller.companyId);

    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const deleteCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) {
      throw new Response("Usuário não está vinculado a uma empresa.", { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("clientes")
      .delete()
      .eq("id", data.id)
      .eq("company_id", caller.companyId);

    if (error) {
      if (error.code === '23503') { // Foreign key violation
        throw new Response("Este cliente não pode ser excluído pois está vinculado a pedidos.", { status: 409 });
      }
      throw new Response(error.message, { status: 500 });
    }
    return { ok: true };
  });
