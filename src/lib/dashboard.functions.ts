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

const TZ = "America/Sao_Paulo";
const ACTIVE_STATUSES = ["novo", "preparo", "pronto"];
const LATE_MINUTES = 25;

// ---- Timezone helpers ---------------------------------------------------
const ZONED_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hour12: false,
});

const WEEKDAY_IDX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

function zonedParts(iso: string) {
  const parts = Object.fromEntries(
    ZONED_FMT.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  // Intl às vezes devolve "24" para meia-noite em hour12:false
  const hourRaw = parts.hour === "24" ? "0" : parts.hour;
  return {
    year: Number(parts.year),
    month: Number(parts.month), // 1-12
    day: Number(parts.day), // 1-31
    hour: Number(hourRaw), // 0-23
    weekdayIdx: WEEKDAY_IDX[parts.weekday] ?? 0, // 0=Seg ... 6=Dom
  };
}

// ---- Bucketização -------------------------------------------------------
type SaleRow = {
  created_at: string;
  paid_at?: string | null;
  total_amount: number | string;
};

function effectiveDate(r: SaleRow): string {
  return r.paid_at ?? r.created_at;
}

function buildBuckets(
  rows: SaleRow[],
  granularity: Granularity,
  from: string,
): ChartPoint[] {
  if (granularity === "day") {
    const b: ChartPoint[] = Array.from({ length: 24 }, (_, i) => ({
      label: `${String(i).padStart(2, "0")}h`,
      value: 0,
    }));
    for (const r of rows) {
      const { hour } = zonedParts(effectiveDate(r));
      b[hour].value += Number(r.total_amount);
    }
    return b;
  }
  if (granularity === "week") {
    const labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const b = labels.map((l) => ({ label: l, value: 0 }));
    for (const r of rows) {
      const { weekdayIdx } = zonedParts(effectiveDate(r));
      b[weekdayIdx].value += Number(r.total_amount);
    }
    return b;
  }
  if (granularity === "month") {
    const ref = zonedParts(from);
    // Total de dias no mês de referência (em SP)
    const days = new Date(ref.year, ref.month, 0).getDate();
    const b: ChartPoint[] = Array.from({ length: days }, (_, i) => ({
      label: String(i + 1),
      value: 0,
    }));
    for (const r of rows) {
      const { day } = zonedParts(effectiveDate(r));
      if (day >= 1 && day <= days) b[day - 1].value += Number(r.total_amount);
    }
    return b;
  }
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const b = labels.map((l) => ({ label: l, value: 0 }));
  for (const r of rows) {
    const { month } = zonedParts(effectiveDate(r));
    b[month - 1].value += Number(r.total_amount);
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

// ---- COMPANY DASHBOARD --------------------------------------------------
export const getCompanyDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("User not linked to a company", { status: 403 });

    const { from, to, granularity } = data;
    const companyId = caller.companyId;
    const lateThreshold = new Date(Date.now() - LATE_MINUTES * 60_000).toISOString();

    // Pedidos com pagamento confirmado no período (por paid_at)
    // + pedidos criados no período (para indicadores operacionais).
    // Fazemos duas queries para que "Vendas pagas" considere a data REAL
    // de pagamento, não a de criação.
    const [createdRes, paidRes, openMesasRes, recentPedRes] = await Promise.all([
      supabaseAdmin
        .from("pedidos")
        .select("id, status, status_financeiro, total_amount, created_at, paid_at, items, canal, mesa_id, fase_canal")
        .eq("company_id", companyId)
        .gte("created_at", from)
        .lte("created_at", to),
      supabaseAdmin
        .from("pedidos")
        .select("id, status, status_financeiro, total_amount, created_at, paid_at, items, canal, mesa_id, fase_canal")
        .eq("company_id", companyId)
        .eq("status_financeiro", "pago")
        .gte("paid_at", from)
        .lte("paid_at", to),
      supabaseAdmin
        .from("mesas")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .neq("status", "livre"),
      supabaseAdmin
        .from("pedidos")
        .select("id, status, status_financeiro, total_amount, created_at, canal, mesa_id, client_id, fase_canal")
        .eq("company_id", companyId)
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const all = (createdRes.data ?? []) as any[];
    const paid = (paidRes.data ?? []) as any[];

    const valorTotalVendido = paid.reduce((s, p) => s + Number(p.total_amount), 0);
    const ticketMedio = paid.length ? valorTotalVendido / paid.length : 0;

    const ativos = all.filter((p) => ACTIVE_STATUSES.includes(p.status));
    const emPreparo = all.filter((p) => p.status === "preparo");
    const prontos = all.filter(
      (p) => p.status === "pronto" && (p.fase_canal == null || p.fase_canal === ""),
    );
    const emExpedicao = all.filter((p) => p.fase_canal === "expedicao");
    const finalizados = all.filter((p) => p.status === "finalizado");
    const atrasados = ativos.filter((p) => p.created_at < lateThreshold);

    return {
      valorTotalVendido,
      ticketMedio,
      pedidosNoPeriodo: all.length,
      vendasConcluidas: paid.length,
      pedidosAtivos: ativos.length,
      emPreparo: emPreparo.length,
      prontos: prontos.length,
      emExpedicao: emExpedicao.length,
      finalizados: finalizados.length,
      atrasados: atrasados.length,
      mesasAbertas: openMesasRes.count ?? 0,
      topItem: topItem(paid),
      porCanal: byCanal(paid),
      chart: buildBuckets(paid, granularity, from),
      recentPedidos: (recentPedRes.data ?? []) as any[],
    };
  });

// ---- SUPER ADMIN DASHBOARD (mantido; agora coerente com a nova regra) ---
export const getSuperAdminDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (caller.role !== "super_admin") throw new Response("Unauthorized", { status: 403 });

    const { from, to, granularity } = data;
    const lateThreshold = new Date(Date.now() - LATE_MINUTES * 60_000).toISOString();

    const [companies, users, createdRes, paidRes] = await Promise.all([
      supabaseAdmin.from("companies").select("id, active"),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("pedidos")
        .select("id, status, status_financeiro, total_amount, created_at, paid_at, items, canal, fase_canal")
        .gte("created_at", from)
        .lte("created_at", to),
      supabaseAdmin
        .from("pedidos")
        .select("id, status_financeiro, total_amount, created_at, paid_at, items, canal")
        .eq("status_financeiro", "pago")
        .gte("paid_at", from)
        .lte("paid_at", to),
    ]);

    const all = (createdRes.data ?? []) as any[];
    const paid = (paidRes.data ?? []) as any[];
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
      porCanal: byCanal(paid),
      chart: buildBuckets(paid, granularity, from),
    };
  });
