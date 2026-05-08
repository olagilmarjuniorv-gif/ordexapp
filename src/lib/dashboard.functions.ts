import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AppRole } from "./users.functions";

// Helper to get user's context
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

// SUPER ADMIN DASHBOARD
export const getSuperAdminDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const caller = await getCaller(context.userId);
    if (caller.role !== 'super_admin') throw new Response("Unauthorized", { status: 403 });

    const [companies, users, pedidos, sales] = await Promise.all([
        supabaseAdmin.from('companies').select('id, active'),
        supabaseAdmin.from('profiles').select('id', { count: 'exact' }),
        supabaseAdmin.from('pedidos').select('id', { count: 'exact' }),
        supabaseAdmin.from('pedidos').select('total_amount').eq('status', 'completed'),
    ]);

    const companyRanking = await supabaseAdmin.rpc('get_company_sales_ranking');

    return {
        totalCompanies: companies.data?.length ?? 0,
        activeCompanies: companies.data?.filter(c => c.active).length ?? 0,
        totalUsers: users.count ?? 0,
        totalPedidos: pedidos.count ?? 0,
        totalSalesValue: sales.data?.reduce((sum, p) => sum + p.total_amount, 0) ?? 0,
        companyRanking: companyRanking.data ?? [],
    };
  });


// COMPANY DASHBOARD
const periodSchema = z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
});

export const getCompanyDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ period: periodSchema }).parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);
    if (!caller.companyId) throw new Response("User not linked to a company", { status: 403 });

    const { from, to } = data.period;

    const [pedidos, orcamentos, products, clients, sales, recentOrcamentos, ongoingPedidos] = await Promise.all([
        // Pedidos in period
        supabaseAdmin.from('pedidos').select('id, status')
            .eq('company_id', caller.companyId).gte('created_at', from).lte('created_at', to),
        // Orcamentos in period
        supabaseAdmin.from('orcamentos').select('id, status', { count: 'exact' })
            .eq('company_id', caller.companyId).gte('created_at', from).lte('created_at', to),
        // All active products
        supabaseAdmin.from('produtos').select('stock, minStock')
            .eq('company_id', caller.companyId).eq('active', true),
        // Total clients
        supabaseAdmin.from('clientes').select('id', { count: 'exact' })
            .eq('company_id', caller.companyId).eq('active', true),
        // Total sales value in period
        supabaseAdmin.from('pedidos').select('total_amount')
            .eq('company_id', caller.companyId).eq('status', 'completed').gte('created_at', from).lte('created_at', to),
        // Recent Orcamentos
        supabaseAdmin.from('orcamentos').select('*, cliente:clientes(*)').eq('company_id', caller.companyId).order('created_at', { ascending: false }).limit(4),
        // Ongoing Pedidos
        supabaseAdmin.from('pedidos').select('*, cliente:clientes(*)').eq('company_id', caller.companyId).neq('status', 'entregue').order('created_at', { ascending: false }).limit(3),
    ]);

    const lowStockProducts = products.data?.filter(p => p.stock <= p.minStock).length ?? 0;
    const openPedidos = pedidos.data?.filter(p => p.status !== 'entregue').length ?? 0;

    return {
        pedidosAbertos: openPedidos,
        orcamentosEnviados: orcamentos.data?.filter(o => o.status === 'sent').length ?? 0,
        orcamentosAprovados: orcamentos.data?.filter(o => o.status === 'approved').length ?? 0,
        produtosEstoqueBaixo: lowStockProducts,
        clientesCadastrados: clients.count ?? 0,
        valorTotalVendido: sales.data?.reduce((sum, p) => sum + p.total_amount, 0) ?? 0,
        recentOrcamentos: recentOrcamentos.data ?? [],
        ongoingPedidos: ongoingPedidos.data ?? [],
    };
  });
