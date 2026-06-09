import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";
import { computeTrial } from "./trial";

export const PLAN_DEFAULTS: Record<"base" | "pro" | "max", { limite_pedidos_mes: number; limite_conversas_mes: number; limite_usuarios: number }> = {
  base: { limite_pedidos_mes: 300, limite_conversas_mes: 300, limite_usuarios: 1 },
  pro: { limite_pedidos_mes: 1500, limite_conversas_mes: 1500, limite_usuarios: 3 },
  max: { limite_pedidos_mes: 0, limite_conversas_mes: 3000, limite_usuarios: 8 },
};

async function assertSuper(userId: string) {
  const c = await getCaller(userId);
  if (!c.isSuperAdmin) throw new Response("Acesso negado", { status: 403 });
}

// =========== LIST ===========
export const listAssinaturas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.userId);

    const [companiesRes, subsRes, intentsRes] = await Promise.all([
      supabaseAdmin.from("companies").select("id, name, active").order("name"),
      supabaseAdmin.from("company_subscriptions").select("*"),
      supabaseAdmin.from("subscription_intents").select("*").order("created_at", { ascending: false }),
    ]);

    const companies = companiesRes.data ?? [];
    const subs = subsRes.data ?? [];
    const subByCompany = new Map(subs.map((s) => [s.company_id, s]));
    const intentByCompany = new Map<string, any>();
    for (const i of intentsRes.data ?? []) {
      if (!intentByCompany.has(i.company_id)) intentByCompany.set(i.company_id, i);
    }

    // contagem do mês corrente
    const startMonth = new Date();
    startMonth.setDate(1); startMonth.setHours(0, 0, 0, 0);
    const iso = startMonth.toISOString();

    const companyIds = companies.map((c) => c.id);
    const [pedRes, convRes, profRes] = await Promise.all([
      supabaseAdmin.from("pedidos").select("company_id").in("company_id", companyIds).gte("created_at", iso),
      supabaseAdmin.from("whatsapp_conversas").select("company_id").in("company_id", companyIds).gte("created_at", iso),
      supabaseAdmin.from("profiles").select("company_id").in("company_id", companyIds).eq("active", true),
    ]);

    const countBy = (rows: { company_id: string | null }[] | null) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) {
        if (!r.company_id) continue;
        m.set(r.company_id, (m.get(r.company_id) ?? 0) + 1);
      }
      return m;
    };
    const pedidosMap = countBy(pedRes.data);
    const convMap = countBy(convRes.data);
    const usuariosMap = countBy(profRes.data);

    return companies.map((c) => {
      const s = subByCompany.get(c.id) ?? null;
      return {
        company_id: c.id,
        company_name: c.name,
        company_active: c.active,
        subscription: s,
        intent: intentByCompany.get(c.id) ?? null,
        uso: {
          pedidos: pedidosMap.get(c.id) ?? 0,
          conversas: convMap.get(c.id) ?? 0,
          usuarios: usuariosMap.get(c.id) ?? 0,
        },
        trial: computeTrial(s?.status, s?.vencimento as string | null | undefined),
      };
    });
  });

// =========== UPDATE ===========
const PLAN = z.enum(["base", "pro", "max"]);
const STATUS = z.enum(["trial", "ativo", "pendente", "inadimplente", "cancelado", "expirado"]);
const CICLO = z.enum(["mensal", "anual"]);

export const updateAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      plano: PLAN,
      status: STATUS,
      ciclo: CICLO,
      inicio: z.string().nullable().optional(),
      vencimento: z.string().nullable().optional(),
    }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuper(context.userId);

    const limites = PLAN_DEFAULTS[data.plano];
    const payload = {
      company_id: data.companyId,
      plano: data.plano,
      status: data.status,
      ciclo: data.ciclo,
      inicio: data.inicio ? new Date(data.inicio).toISOString() : null,
      vencimento: data.vencimento || null,
      ...limites,
    };

    const { data: existing } = await supabaseAdmin
      .from("company_subscriptions")
      .select("id")
      .eq("company_id", data.companyId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("company_subscriptions")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("company_subscriptions").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// =========== LIST MY COBRANCAS (admin da empresa) ===========
export const listMyCobrancas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    if (!c.companyId) return [];
    if (!c.isCompanyAdmin && !c.isSuperAdmin) return [];
    const { data, error } = await supabaseAdmin
      .from("cobrancas")
      .select("id, valor, vencimento, paid_at, status, payment_method, metadata, created_at, external_id")
      .eq("company_id", c.companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// =========== PENDING COBRANCA (anti-duplicidade) ===========
export const getMyPendingCobranca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    if (!c.companyId) return null;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabaseAdmin
      .from("cobrancas")
      .select("id, external_id, valor, vencimento, status, payment_method, metadata, created_at")
      .eq("company_id", c.companyId)
      .in("status", ["pendente", "pending", "awaiting_payment"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    if (data.vencimento && data.vencimento < today) return null;
    return data;
  });
