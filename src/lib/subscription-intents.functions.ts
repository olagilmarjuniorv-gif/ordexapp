import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

const PLAN = z.enum(["base", "pro", "max"]);
const CICLO = z.enum(["mensal", "anual"]);

/**
 * Cria uma intenção de contratação para a empresa do caller.
 * Requer role `admin` (admin da empresa). Não altera o plano ativo
 * nem gera cobrança — apenas registra a escolha.
 */
export const createSubscriptionIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ plano: PLAN, ciclo: CICLO }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.companyId) throw new Response("Usuário sem empresa", { status: 403 });
    if (!c.isCompanyAdmin && !c.isSuperAdmin) {
      throw new Response("Apenas administradores podem escolher um plano", { status: 403 });
    }

    // Cancela intenções anteriores ainda em "aguardando_pagamento"
    await supabaseAdmin
      .from("subscription_intents")
      .update({ status: "cancelado" })
      .eq("company_id", c.companyId)
      .eq("status", "aguardando_pagamento");

    const { data: row, error } = await supabaseAdmin
      .from("subscription_intents")
      .insert({
        company_id: c.companyId,
        user_id: context.userId,
        plano: data.plano,
        ciclo: data.ciclo,
        status: "aguardando_pagamento",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Retorna a intenção mais recente da empresa do caller (ou null).
 */
export const getMySubscriptionIntent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    if (!c.companyId) return null;
    const { data } = await supabaseAdmin
      .from("subscription_intents")
      .select("*")
      .eq("company_id", c.companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

/**
 * Super admin: lista a intenção mais recente por empresa.
 * Retorna um Map { [company_id]: intent }
 */
export const listLatestIntents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    if (!c.isSuperAdmin) throw new Response("Acesso negado", { status: 403 });
    const { data } = await supabaseAdmin
      .from("subscription_intents")
      .select("*")
      .order("created_at", { ascending: false });
    const map: Record<string, any> = {};
    for (const row of data ?? []) {
      if (!map[row.company_id]) map[row.company_id] = row;
    }
    return map;
  });
