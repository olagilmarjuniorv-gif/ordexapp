import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Cadastro self-service público.
 * - cria empresa (trigger cria trial subscription + categorias padrão)
 * - cria usuário Supabase Auth com e-mail real
 * - atualiza profile (full_name, phone, company_id)
 * - atribui role 'admin'
 *
 * NÃO usa listUsers para checar duplicidade — é O(N) e estoura o
 * timeout do Worker. Deixa o próprio createUser falhar e mapeia o erro.
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
    // 1. cria empresa (trigger cria trial subscription + categorias padrão)
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
      console.error("[signupCompany] company insert failed", cErr);
      throw new Response(
        `Não foi possível criar o restaurante: ${cErr?.message ?? "erro desconhecido"}`,
        { status: 500 },
      );
    }

    // 2. cria usuário auth (createUser falha com mensagem específica se e-mail já existe)
    const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.whatsapp },
    });
    if (uErr || !created?.user) {
      console.error("[signupCompany] createUser failed", uErr);
      // rollback empresa
      await supabaseAdmin.from("companies").delete().eq("id", company.id);

      const raw = (uErr?.message ?? "").toLowerCase();
      if (
        raw.includes("already") ||
        raw.includes("registered") ||
        raw.includes("exists") ||
        raw.includes("duplicate")
      ) {
        throw new Response("Este e-mail já está cadastrado", { status: 400 });
      }
      if (raw.includes("password")) {
        throw new Response("Senha inválida. Use pelo menos 6 caracteres.", { status: 400 });
      }
      throw new Response(
        `Não foi possível criar o usuário: ${uErr?.message ?? "erro desconhecido"}`,
        { status: 400 },
      );
    }
    const uid = created.user.id;

    // 3. atualiza profile (handle_new_user já criou linha)
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.whatsapp,
        company_id: company.id,
        active: true,
      })
      .eq("id", uid);
    if (pErr) {
      console.error("[signupCompany] profile update failed", pErr);
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      throw new Response(
        `Não foi possível vincular usuário à empresa: ${pErr.message}`,
        { status: 500 },
      );
    }

    // 4. role admin
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "admin" });
    if (rErr) {
      console.error("[signupCompany] user_roles insert failed", rErr);
      throw new Response(
        `Não foi possível atribuir permissões: ${rErr.message}`,
        { status: 500 },
      );
    }

    return { ok: true, company_id: company.id, user_id: uid, email: data.email };
  });
