import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["admin", "vendedor", "entregador"] as const;
export type AppRole = (typeof ROLES)[number];

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Response(error.message, { status: 500 });
  if (!data) throw new Response("Acesso negado", { status: 403 });
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, active, created_at")
      .order("created_at", { ascending: false });
    if (pErr) throw new Response(pErr.message, { status: 500 });

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Response(rErr.message, { status: 500 });

    const { data: usersList, error: uErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (uErr) throw new Response(uErr.message, { status: 500 });

    return (profiles ?? []).map((p) => {
      const u = usersList.users.find((x) => x.id === p.id);
      const role = roles?.find((r) => r.user_id === p.id)?.role as AppRole | undefined;
      return {
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        active: p.active,
        email: u?.email ?? "",
        role: role ?? null,
      };
    });
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
        password: z.string().min(6).max(128),
        role: z.enum(ROLES),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Response(error.message, { status: 400 });
    const uid = created.user!.id;
    // Profile is auto-created by trigger; ensure name set
    await supabaseAdmin.from("profiles").update({ full_name: data.full_name }).eq("id", uid);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: data.role });
    if (rErr) throw new Response(rErr.message, { status: 500 });
    return { id: uid };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
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
    await assertAdmin(context.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

// Bootstrap: if no admin exists, promote current user to admin.
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if (error) throw new Response(error.message, { status: 500 });
    if ((count ?? 0) > 0) return { promoted: false };
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (insErr) throw new Response(insErr.message, { status: 500 });
    return { promoted: true };
  });
