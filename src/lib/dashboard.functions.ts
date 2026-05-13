import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

export type Granularity = "day" | "week" | "month" | "year";
export type ChartPoint = { label: string; value: number };

const granularitySchema = z.enum(["day", "week", "month", "year"]);
const inputSchema = z.object({
  granularity: granularitySchema,
  from: z.string().datetime(),
  to: z.string().datetime(),
});

const PAID = "pago";
const ACTIVE_STATUSES = ["novo", "preparo", "pronto"];
const LATE_MINUTES = 25;

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

function topItem(rows: Array<{ items: any }>): { name: string; qty: number } | null {
  const map = new Map<string, number>();
  for (const r of rows) {
    const items = Array.isArray(r.items) ? r.items : [];
    for (const it of items) {
      const name = it?.name ?? "Item";
      const qty = Number(it?.quantity ?? 1);
      map.set(name, (map.get(name) ?? 0) + qty);
    }
  }
  let best: { name: string; qty: number } | null = null;
  for (const [name, qty] of map) {
    if (!best || qty > best.qty) best = { name, qty };
  }
  return best;
}

function byCanal(rows: Array<{ canal?: string | null }>) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const c = r.canal ?? "salao";
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return Array.from(m.entries()).map(([canal, count]) => ({ canal, count }));
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
    const lateThreshold = new Date(Date.now() - LATE_MINUTES * 60_000).toISOString();

    const [pedidosRes, openMesasRes, recentPedRes] = await Promise.all([
      supabaseAdmin.from("pedidos").select("id, status, total_amount, created_at, items, canal, mesa_id")
        .eq("company_id", companyId).gte("created_at", from).lte("created_at", to),
      supabaseAdmin.from("mesas").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).neq("status", "livre"),
      supabaseAdmin.from("pedidos").select("id, status, total_amount, created_at, canal, mesa_id, cliente:clientes(name, phone)")
        .eq("company_id", companyId).in("status", ACTIVE_STATUSES).order("created_at", { ascending: false }).limit(8),
    ]);

    const all = (pedidosRes.data ?? []) as any[];
    const paid = all.filter((p) => p.status === PAID);
    const valorTotalVendido = paid.reduce((s, p) => s + Number(p.total_amount), 0);
    const ticketMedio = paid.length ? valorTotalVendido / paid.length : 0;

    const ativos = all.filter((p) => ACTIVE_STATUSES.includes(p.status));
    const emPreparo = all.filter((p) => p.status === "preparo");
    const atrasados = ativos.filter((p) => p.created_at < lateThreshold);

    return {
      valorTotalVendido,
      ticketMedio,
      pedidosNoPeriodo: all.length,
      vendasConcluidas: paid.length,
      pedidosAtivos: ativos.length,
      emPreparo: emPreparo.length,
      atrasados: atrasados.length,
      mesasAbertas: openMesasRes.count ?? 0,
      topItem: topItem(paid),
      porCanal: byCanal(all),
      chart: buildBuckets(paid, granularity, from),
      recentPedidos: (recentPedRes.data ?? []) as any[],
    };
  });

// SUPER ADMIN DASHBOARD
export const getSuperAdminDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (caller.role !== "super_admin") throw new Response("Unauthorized", { status: 403 });

    const { from, to, granularity } = data;
    const lateThreshold = new Date(Date.now() - LATE_MINUTES * 60_000).toISOString();

    const [companies, users, pedidosRes] = await Promise.all([
      supabaseAdmin.from("companies").select("id, active"),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("pedidos").select("id, status, total_amount, created_at, items, canal")
        .gte("created_at", from).lte("created_at", to),
    ]);

    const all = (pedidosRes.data ?? []) as any[];
    const paid = all.filter((p) => p.status === PAID);
    const totalSalesValue = paid.reduce((s, p) => s + Number(p.total_amount), 0);
    const ativos = all.filter((p) => ACTIVE_STATUSES.includes(p.status));
    const atrasados = ativos.filter((p) => p.created_at < lateThreshold);

    return {
      totalCompanies: companies.data?.length ?? 0,
      activeCompanies: companies.data?.filter((c) => c.active).length ?? 0,
      totalUsers: users.count ?? 0,
      pedidosNoPeriodo: all.length,
      vendasConcluidas: paid.length,
      pedidosAtivos: ativos.length,
      atrasados: atrasados.length,
      ticketMedio: paid.length ? totalSalesValue / paid.length : 0,
      totalSalesValue,
      topItem: topItem(paid),
      porCanal: byCanal(all),
      chart: buildBuckets(paid, granularity, from),
    };
  });
