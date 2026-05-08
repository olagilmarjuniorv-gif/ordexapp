import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, FileText, ShoppingBag, TrendingUp, Users, Plus, Building2, ShieldCheck } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { OrderBadge, QuoteBadge } from "@/components/StatusBadge";
import { WhatsappButton } from "@/components/WhatsappButton";
import { getCompanyDashboardData, getSuperAdminDashboardData } from "@/lib/dashboard.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Painel — ORDEX" }] }),
});

function SuperAdminDashboard() {
  const fetchFn = useServerFn(getSuperAdminDashboardData);
  const { data, isLoading, error } = useQuery({
    queryKey: ["super-admin-dashboard"],
    queryFn: () => fetchFn(),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Erro ao carregar painel: {(error as Error)?.message ?? "desconhecido"}</div>;
  }

  const stats = [
    { label: "Empresas ativas", value: `${data.activeCompanies}/${data.totalCompanies}`, icon: Building2, tone: "bg-primary/10 text-primary" },
    { label: "Usuários totais", value: data.totalUsers, icon: Users, tone: "bg-info/15 text-info" },
    { label: "Pedidos totais", value: data.totalPedidos, icon: ShoppingBag, tone: "bg-warning/20 text-warning-foreground" },
    { label: "Vendas globais", value: formatBRL(data.totalSalesValue), icon: TrendingUp, tone: "bg-success/15 text-success" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Super administrador</p>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Painel global</h1>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <span className={`flex h-7 w-7 items-center justify-center rounded-md ${s.tone}`}>
                <s.icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 font-display text-xl lg:text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Link to="/empresas" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-95">
          <Building2 className="h-4 w-4" /> Gerenciar empresas
        </Link>
        <Link to="/usuarios" className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold hover:bg-muted">
          <ShieldCheck className="h-4 w-4" /> Usuários
        </Link>
      </div>
    </div>
  );
}

function Dashboard() {
  const { isSuperAdmin, companyId, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (isSuperAdmin) return <SuperAdminDashboard />;
  if (!companyId) {
    return <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">Sua conta ainda não está vinculada a uma empresa. Contate o administrador.</div>;
  }
  return <CompanyDashboard />;
}

function CompanyDashboard() {
  const fetchFn = useServerFn(getCompanyDashboardData);
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchFn({ data: { period: { from: from.toISOString(), to: to.toISOString() } } }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Erro ao carregar painel: {(error as Error)?.message ?? "desconhecido"}</div>;
  }

  const stats = [
    { label: "Vendas no período", value: formatBRL(data.valorTotalVendido), icon: TrendingUp, tone: "bg-primary/10 text-primary" },
    { label: "Pedidos abertos", value: data.pedidosAbertos, icon: ShoppingBag, tone: "bg-info/15 text-info" },
    { label: "Orçamentos enviados", value: data.orcamentosEnviados, icon: FileText, tone: "bg-warning/20 text-warning-foreground" },
    { label: "Orçamentos aprovados", value: data.orcamentosAprovados, icon: Users, tone: "bg-success/15 text-success" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Olá, vendedor 👷</p>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Painel da loja</h1>
        </div>
        <Link
          to="/orcamentos/novo"
          className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> Novo orçamento
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <span className={`flex h-7 w-7 items-center justify-center rounded-md ${s.tone}`}>
                <s.icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 font-display text-xl lg:text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick action mobile */}
      <Link
        to="/orcamentos/novo"
        className="sm:hidden flex items-center justify-between rounded-xl p-4 text-primary-foreground shadow-elevated"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div>
          <p className="text-xs opacity-80">Atalho rápido</p>
          <p className="font-semibold">Criar novo orçamento</p>
        </div>
        <Plus className="h-5 w-5" />
      </Link>

      <section className="rounded-xl border border-border bg-card shadow-card">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display font-semibold">Orçamentos recentes</h2>
          <Link to="/orcamentos" className="text-xs text-primary inline-flex items-center gap-1">
            Ver todos <ArrowUpRight className="h-3 w-3" />
          </Link>
        </header>
        <ul className="divide-y divide-border">
          {data.recentOrcamentos.map((q: any) => (
            <li key={q.id} className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary text-xs font-bold">
                {String(q.id).slice(-3)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{q.cliente?.name}</p>
                <p className="text-xs text-muted-foreground">#{String(q.id).slice(0,6)} · {new Date(q.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatBRL(Number(q.total_amount))}</p>
                <div className="mt-1"><QuoteBadge status={q.status} /></div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display font-semibold">Pedidos em andamento</h2>
          <Link to="/pedidos" className="text-xs text-primary inline-flex items-center gap-1">
            Ver todos <ArrowUpRight className="h-3 w-3" />
          </Link>
        </header>
        <ul className="divide-y divide-border">
          {data.ongoingPedidos.map((o: any) => (
            <li key={o.id} className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{o.cliente?.name}</p>
                <p className="text-xs text-muted-foreground">#{String(o.id).slice(0,6)} · {formatBRL(Number(o.total_amount))}</p>
              </div>
              <OrderBadge status={o.status} />
              <WhatsappButton phone={o.cliente?.phone} variant="ghost" label="" message={`Olá ${o.cliente?.name}, atualização do pedido #${String(o.id).slice(0,6)}.`} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
