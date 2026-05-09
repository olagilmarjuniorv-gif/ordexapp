import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Resolves a username to the underlying Supabase auth email so the
 * client can call signInWithPassword with the real email.
 * Public (unauthenticated) by design — like a login lookup.
 */
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        username: z.string().trim().min(1).max(64),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const username = data.username.toLowerCase();

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, active")
      .ilike("username", username)
      .maybeSingle();

    if (error) throw new Response("Erro ao buscar usuário", { status: 500 });
    if (!profile) throw new Response("Usuário ou senha inválidos", { status: 404 });
    if (profile.active === false) {
      throw new Response("Conta desativada", { status: 403 });
    }

    const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (uErr || !u?.user?.email) {
      throw new Response("Usuário ou senha inválidos", { status: 404 });
    }
    return { email: u.user.email };
  });
