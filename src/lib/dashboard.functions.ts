import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AppRole } from "./users.functions";

type Caller = {
  userId: string;
  role: AppRole | null;
  companyId: string | null;
};

async function getCaller(userId: string): Promise<Caller> {
  const [{ data: r }, { data: p }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
  ]);
  const role = (r?.role as AppRole | undefined) ?? null;
  return { userId, role, companyId: p?.company_id ?? null };
}

export type Granularity = "day" | "week" | "month" | "year";
export type ChartPoint = { label: string; value: number };

const granularitySchema = z.enum(["day", "week", "month", "year"]);
const inputSchema = z.object({
  granularity: granularitySchema,
  from: z.string().datetime(),
  to: z.string().datetime(),
});

function buildBuckets(
  rows: Array<{ created_at: string; total_amount: number | string }>,
  granularity: Granularity,
  from: string,
): ChartPoint[] {
  const fromD = new Date(from);
  if (granularity === "day") {
    const b: ChartPoint[] = Array.from({ length: 24 }, (_, i) => ({
      label: `${String(i).padStart(2, "0")}h`,
      value: 0,
    }));
    for (const r of rows) {
      const h = new Date(r.created_at).getHours();
      b[h].value += Number(r.total_amount);
    }
    return b;
  }
  if (granularity === "week") {
    const labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const b = labels.map((l) => ({ label: l, value: 0 }));
    for (const r of rows) {
      const d = new Date(r.created_at).getDay();
      const idx = d === 0 ? 6 : d - 1;
      b[idx].value += Number(r.total_amount);
    }
    return b;
  }
  if (granularity === "month") {
    const days = new Date(fromD.getFullYear(), fromD.getMonth() + 1, 0).getDate();
    const b: ChartPoint[] = Array.from({ length: days }, (_, i) => ({
      label: String(i + 1),
      value: 0,
    }));
    for (const r of rows) {
      const day = new Date(r.created_at).getDate();
      b[day - 1].value += Number(r.total_amount);
    }
    return b;
  }
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const b = labels.map((l) => ({ label: l, value: 0 }));
  for (const r of rows) {
    const m = new Date(r.created_at).getMonth();
    b[m].value += Number(r.total_amount);
  }
  return b;
}

// COMPANY DASHBOARD
export const getCompanyDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("User not linked to a company", { status: 403 });

    const { from, to, granularity } = data;
    const companyId = caller.companyId;

    const [pedidosRes, orcamentosRes, openPedidosRes, productsRes, clientsRes, recentOrcRes, ongoingPedRes] = await Promise.all([
      supabaseAdmin.from("pedidos").select("id, status, total_amount, created_at")
        .eq("company_id", companyId).gte("created_at", from).lte("created_at", to),
      supabaseAdmin.from("orcamentos").select("id, status", { count: "exact" })
        .eq("company_id", companyId).gte("created_at", from).lte("created_at", to),
      supabaseAdmin.from("pedidos").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).neq("status", "completed"),
      supabaseAdmin.from("produtos").select('stock, "minStock"')
        .eq("company_id", companyId).eq("active", true),
      supabaseAdmin.from("clientes").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).eq("active", true),
      supabaseAdmin.from("orcamentos").select("*, cliente:clientes(*)").eq("company_id", companyId).order("created_at", { ascending: false }).limit(4),
      supabaseAdmin.from("pedidos").select("*, cliente:clientes(*)").eq("company_id", companyId).neq("status", "completed").order("created_at", { ascending: false }).limit(3),
    ]);

    const all = (pedidosRes.data ?? []) as any[];
    const completed = all.filter((p) => p.status === "completed");
    const valorTotalVendido = completed.reduce((s, p) => s + Number(p.total_amount), 0);
    const lowStock = (productsRes.data ?? []).filter((p: any) => Number(p.stock) <= Number(p.minStock)).length;

    return {
      valorTotalVendido,
      pedidosNoPeriodo: all.length,
      orcamentosNoPeriodo: orcamentosRes.count ?? 0,
      vendasConcluidas: completed.length,
      pedidosAbertos: openPedidosRes.count ?? 0,
      orcamentosEnviados: orcamentosRes.data?.filter((o: any) => o.status === "sent").length ?? 0,
      orcamentosAprovados: orcamentosRes.data?.filter((o: any) => o.status === "approved").length ?? 0,
      produtosEstoqueBaixo: lowStock,
      clientesCadastrados: clientsRes.count ?? 0,
      chart: buildBuckets(completed, granularity, from),
      recentOrcamentos: (recentOrcRes.data ?? []) as any[],
      ongoingPedidos: (ongoingPedRes.data ?? []) as any[],
    };
  });

// SUPER ADMIN DASHBOARD (consolidated across all companies)
export const getSuperAdminDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (caller.role !== "super_admin") throw new Response("Unauthorized", { status: 403 });

    const { from, to, granularity } = data;

    const [companies, users, pedidosRes, orcamentosRes] = await Promise.all([
      supabaseAdmin.from("companies").select("id, active"),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("pedidos").select("id, status, total_amount, created_at")
        .gte("created_at", from).lte("created_at", to),
      supabaseAdmin.from("orcamentos").select("id, status", { count: "exact", head: true })
        .gte("created_at", from).lte("created_at", to),
    ]);

    const all = (pedidosRes.data ?? []) as any[];
    const completed = all.filter((p) => p.status === "completed");
    const totalSalesValue = completed.reduce((s, p) => s + Number(p.total_amount), 0);

    return {
      totalCompanies: companies.data?.length ?? 0,
      activeCompanies: companies.data?.filter((c) => c.active).length ?? 0,
      totalUsers: users.count ?? 0,
      pedidosNoPeriodo: all.length,
      orcamentosNoPeriodo: orcamentosRes.count ?? 0,
      vendasConcluidas: completed.length,
      totalSalesValue,
      chart: buildBuckets(completed, granularity, from),
    };
  });
