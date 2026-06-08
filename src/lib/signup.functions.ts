import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Cadastro self-service público.
 * - cria empresa (trigger cria trial subscription + categorias padrão)
 * - cria usuário Supabase Auth com e-mail real
 * - atualiza profile (full_name, phone, company_id)
 * - atribui role 'admin'
 */
export const signupCompany = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        restaurante: z.string().trim().min(2).max(120),
        full_name: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email().max(160),
        whatsapp: z.string().trim().min(8).max(40),
        password: z.string().min(6).max(128),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    // Confere e-mail pré-existente direto em auth.users via admin API
    const { data: userByEmail } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const conflict = userByEmail?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === data.email,
    );
    if (conflict) {
      throw new Response("Este e-mail já está cadastrado", { status: 400 });
    }

    // 2. cria empresa (trigger cria trial subscription)
    const { data: company, error: cErr } = await supabaseAdmin
      .from("companies")
      .insert({
        name: data.restaurante,
        phone: data.whatsapp,
        whatsapp: data.whatsapp,
        email: data.email,
        active: true,
      })
      .select("id")
      .single();
    if (cErr || !company) {
      throw new Response("Não foi possível criar o restaurante", { status: 500 });
    }

    // 3. cria usuário auth
    const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.whatsapp },
    });
    if (uErr || !created?.user) {
      // rollback empresa
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      throw new Response(uErr?.message ?? "Falha ao criar usuário", { status: 400 });
    }
    const uid = created.user.id;

    // 4. atualiza profile (handle_new_user já criou linha)
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.whatsapp,
        company_id: company.id,
        active: true,
      })
      .eq("id", uid);

    // 5. role admin
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "admin" });
    if (rErr) {
      throw new Response(rErr.message, { status: 500 });
    }

    return { ok: true, company_id: company.id, user_id: uid, email: data.email };
  });
