import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

export const getSaasOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const caller = await getCaller(context.userId);
    if (!caller.isSuperAdmin) throw new Response("Unauthorized", { status: 403 });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
    const prevWeekStart = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString();

    const [companiesRes, profilesRes, pedidosRes, ticketsRes] = await Promise.all([
      supabaseAdmin.from("companies").select("id, name, active, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, full_name, company_id, last_login_at, active, created_at"),
      supabaseAdmin.from("pedidos").select("id, company_id, created_at"),
      supabaseAdmin.from("tickets").select("id, company_id, status").in("status", ["aberto", "em_andamento", "aguardando"]),
    ]);

    const companies = companiesRes.data ?? [];
    const profiles = profilesRes.data ?? [];
    const pedidos = pedidosRes.data ?? [];
    const tickets = ticketsRes.data ?? [];

    const totalCompanies = companies.length;
    const activeCompanies = companies.filter((c) => c.active).length;
    const inactiveCompanies = totalCompanies - activeCompanies;

    const totalUsers = profiles.length;
    const activeUsersWeek = profiles.filter(
      (p) => p.last_login_at && p.last_login_at >= weekAgo,
    ).length;
    const inactiveUsers = totalUsers - activeUsersWeek;

    const recentCompanies = companies.slice(0, 8).map((c) => ({
      id: c.id,
      name: c.name,
      active: c.active,
      created_at: c.created_at,
    }));

    const recentLogins = profiles
      .filter((p) => p.last_login_at)
      .sort((a, b) => (b.last_login_at! > a.last_login_at! ? 1 : -1))
      .slice(0, 8)
      .map((p) => ({ id: p.id, full_name: p.full_name, last_login_at: p.last_login_at }));

    const cMap = new Map(companies.map((c) => [c.id, c.name]));

    // Pedidos por empresa
    const pedidosByCompany = new Map<string, number>();
    for (const p of pedidos) pedidosByCompany.set(p.company_id, (pedidosByCompany.get(p.company_id) ?? 0) + 1);

    const pedidosWeekByCompany = new Map<string, number>();
    for (const p of pedidos) {
      if (p.created_at >= weekAgo) {
        pedidosWeekByCompany.set(p.company_id, (pedidosWeekByCompany.get(p.company_id) ?? 0) + 1);
      }
    }

    const ticketsByCompany = new Map<string, number>();
    for (const t of tickets) ticketsByCompany.set(t.company_id, (ticketsByCompany.get(t.company_id) ?? 0) + 1);

    const companiesUsage = companies
      .map((c) => ({
        id: c.id,
        name: c.name,
        pedidos_total: pedidosByCompany.get(c.id) ?? 0,
        pedidos_semana: pedidosWeekByCompany.get(c.id) ?? 0,
        chamados_abertos: ticketsByCompany.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.pedidos_total - a.pedidos_total);

    const topCompanies = companiesUsage.slice(0, 5);
    const idleCompanies = companiesUsage
      .filter((c) => c.pedidos_semana === 0)
      .slice(0, 5);

    const totalPedidos = pedidos.length;
    const pedidosWeek = pedidos.filter((p) => p.created_at >= weekAgo).length;
    const pedidosPrevWeek = pedidos.filter((p) => p.created_at >= prevWeekStart && p.created_at < weekAgo).length;
    const pedidosMonth = pedidos.filter((p) => p.created_at >= monthAgo).length;
    const weeklyGrowthPct = pedidosPrevWeek === 0
      ? (pedidosWeek > 0 ? 100 : 0)
      : Math.round(((pedidosWeek - pedidosPrevWeek) / pedidosPrevWeek) * 100);

    const openTickets = tickets.length;
    const companiesWithTickets = new Set(tickets.map((t) => t.company_id)).size;

    return {
      totalCompanies,
      activeCompanies,
      inactiveCompanies,
      totalUsers,
      activeUsersWeek,
      inactiveUsers,
      totalPedidos,
      pedidosWeek,
      pedidosMonth,
      weeklyGrowthPct,
      openTickets,
      companiesWithTickets,
      recentCompanies,
      recentLogins,
      topCompanies,
      idleCompanies,
      companyMap: Object.fromEntries(cMap),
    };
  });
