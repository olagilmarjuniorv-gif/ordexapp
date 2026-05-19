import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, ShoppingBag, TrendingUp, Users, Plus, Building2, ShieldCheck, BadgeCheck, Loader2, ChefHat, AlarmClock, LayoutGrid, Trophy, MessageSquare, Activity, TrendingDown, Clock } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { getCompanyDashboardData } from "@/lib/dashboard.functions";
import { getSaasOverview } from "@/lib/saas.functions";
import { listPedidos } from "@/lib/pedidos.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { SalesChart } from "@/components/SalesChart";
import { type Granularity, GRANULARITY_LABELS, getPeriodRange } from "@/lib/period";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Painel — ORDEX" }] }),
});

const canalLabel: Record<string, string> = {
  salao: "Salão",
  balcao: "Balcão",
  retirada: "Retirada",
  delivery: "Delivery",
  whatsapp: "WhatsApp",
};
const statusLabel: Record<string, string> = {
  novo: "Novo",
  preparo: "Em preparo",
  pronto: "Pronto",
  pago: "Pago",
  cancelado: "Cancelado",
};

function PeriodTabs({ value, onChange }: { value: Granularity; onChange: (g: Granularity) => void }) {
  const opts: Granularity[] = ["day", "week", "month", "year"];
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === o ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {GRANULARITY_LABELS[o]}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone, to }: { label: string; value: string | number; icon: any; tone: string; to?: string }) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${tone}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 font-display text-xl lg:text-2xl font-bold">{value}</p>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="card-premium p-4 block">
        {inner}
      </Link>
    );
  }
  return <div className="card-premium p-4">{inner}</div>;
}

function ChartSection({ chart, granularity, onChange, loading }: {
  chart: { label: string; value: number }[];
  granularity: Granularity;
  onChange: (g: Granularity) => void;
  loading?: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-semibold">Faturamento</h2>
          <p className="text-xs text-muted-foreground">Vendas pagas por período</p>
        </div>
        <PeriodTabs value={granularity} onChange={onChange} />
      </header>
      {loading ? (
        <div className="flex h-[260px] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <SalesChart data={chart} />
      )}
    </section>
  );
}

function CanalBars({ data }: { data: { canal: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem pedidos no período.</p>;
  }
  return (
    <ul className="space-y-2">
      {data.map((d) => {
        const pct = Math.round((d.count / total) * 100);
        return (
          <li key={d.canal}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium">{canalLabel[d.canal] ?? d.canal}</span>
              <span className="text-muted-foreground">{d.count} · {pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SuperAdminDashboard() {
  const fetchFn = useServerFn(getSaasOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["saas-overview"],
    queryFn: () => fetchFn({}),
  });

  if (isLoading && !data) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Erro ao carregar painel: {(error as Error)?.message ?? "desconhecido"}</div>;

  const growthPositive = data.weeklyGrowthPct >= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Plataforma ORDEX</p>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Painel SaaS</h1>
          <p className="text-xs text-muted-foreground mt-1">Gestão das empresas clientes</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Empresas totais" value={data.totalCompanies} icon={Building2} tone="bg-primary/10 text-primary" to="/empresas" />
        <StatCard label="Empresas ativas" value={data.activeCompanies} icon={BadgeCheck} tone="bg-success/15 text-success" to="/empresas" />
        <StatCard label="Empresas inativas" value={data.inactiveCompanies} icon={TrendingDown} tone="bg-muted text-muted-foreground" to="/empresas" />
        <StatCard label="Chamados abertos" value={data.openTickets} icon={MessageSquare} tone="bg-rose-100 text-rose-600" to="/chamados" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Usuários totais" value={data.totalUsers} icon={Users} tone="bg-info/15 text-info" to="/usuarios" />
        <StatCard label="Ativos (7 dias)" value={data.activeUsersWeek} icon={Activity} tone="bg-emerald-100 text-emerald-700" />
        <StatCard label="Pedidos plataforma" value={data.totalPedidos} icon={ShoppingBag} tone="bg-primary/10 text-primary" />
        <StatCard
          label="Crescimento semanal"
          value={`${growthPositive ? "+" : ""}${data.weeklyGrowthPct}%`}
          icon={growthPositive ? TrendingUp : TrendingDown}
          tone={growthPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="rounded-xl border border-border bg-card p-4 shadow-card">
          <header className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold inline-flex items-center gap-2"><Trophy className="h-4 w-4" /> Empresas com maior uso</h2>
          </header>
          {data.topCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <ul className="space-y-2">
              {data.topCompanies.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                  <span className="font-medium truncate">{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">{c.pedidos_total} pedidos · <span className="text-foreground">{c.pedidos_semana}</span> semana</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-card">
          <header className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold inline-flex items-center gap-2"><AlarmClock className="h-4 w-4" /> Sem uso recente (7 dias)</h2>
          </header>
          {data.idleCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todas as empresas com atividade na semana 🎉</p>
          ) : (
            <ul className="space-y-2">
              {data.idleCompanies.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                  <span className="font-medium truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.pedidos_total} total</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="font-display font-semibold mb-3 inline-flex items-center gap-2"><Building2 className="h-4 w-4" /> Últimas empresas criadas</h2>
          {data.recentCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma empresa criada.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentCompanies.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                  <span className="font-medium truncate inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${c.active ? "bg-emerald-500" : "bg-zinc-400"}`} />
                    {c.name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="font-display font-semibold mb-3 inline-flex items-center gap-2"><Clock className="h-4 w-4" /> Últimos logins</h2>
          {data.recentLogins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem logins registrados.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentLogins.map((u) => (
                <li key={u.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                  <span className="font-medium truncate">{u.full_name || "—"}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link to="/empresas" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-95">
          <Building2 className="h-4 w-4" /> Empresas
        </Link>
        <Link to="/usuarios" className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold hover:bg-muted">
          <ShieldCheck className="h-4 w-4" /> Usuários
        </Link>
        <Link to="/chamados" className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold hover:bg-muted">
          <MessageSquare className="h-4 w-4" /> Chamados
        </Link>
      </div>
    </div>
  );
}

function Dashboard() {
  const { isSuperAdmin, isAtendente, companyId, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (isSuperAdmin) return <SuperAdminDashboard />;
  if (!companyId) {
    return <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">Sua conta ainda não está vinculada a uma empresa. Contate o administrador.</div>;
  }
  if (isAtendente) return <AtendenteDashboard />;
  return <CompanyDashboard />;
}

function AtendenteDashboard() {
  const fetchFn = useServerFn(getCompanyDashboardData);
  const range = getPeriodRange("day");
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-atendente"],
    queryFn: () => fetchFn({ data: { granularity: "day", ...range } }),
  });
  useRealtimeInvalidate("pedidos", [["dashboard-atendente"], ["pedidos"]]);
  useRealtimeInvalidate("mesas", [["dashboard-atendente"]]);

  const fetchPedidos = useServerFn(listPedidos);
  const { data: pedidos = [] } = useQuery({ queryKey: ["pedidos"], queryFn: () => fetchPedidos({}) });

  if (isLoading && !data) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Erro ao carregar painel: {(error as Error)?.message ?? "desconhecido"}</div>;

  const ativos = (pedidos as any[]).filter((p) => ["novo", "preparo", "pronto"].includes(p.status));
  const fechados = (pedidos as any[]).filter((p) => ["pago", "cancelado"].includes(p.status)).slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Operação de hoje 🍔</p>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Meu painel</h1>
        </div>
        <Link to="/pedidos/novo" className="inline-flex items-center gap-2 rounded-lg bg-cta px-3.5 py-2 text-sm font-semibold text-cta-foreground shadow hover:brightness-110 hover:shadow-glow-cta transition-all">
          <Plus className="h-4 w-4" /> Novo pedido
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Pedidos ativos" value={data.pedidosAtivos} icon={ShoppingBag} tone="bg-info/15 text-info" to="/pedidos" />
        <StatCard label="Em preparo" value={data.emPreparo} icon={ChefHat} tone="bg-amber-100 text-amber-700" to="/pedidos" />
        <StatCard label="Atrasados" value={data.atrasados} icon={AlarmClock} tone="bg-rose-100 text-rose-600" to="/pedidos" />
        <StatCard label="Mesas abertas" value={data.mesasAbertas} icon={LayoutGrid} tone="bg-primary/10 text-primary" to="/mesas" />
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display font-semibold">Pedidos em aberto</h2>
          <Link to="/pedidos" className="text-xs text-primary inline-flex items-center gap-1">Ver todos <ArrowUpRight className="h-3 w-3" /></Link>
        </header>
        <ul className="divide-y divide-border">
          {ativos.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nenhum pedido em aberto.</li>}
          {ativos.map((o: any) => (
            <li key={o.id}>
              <Link to="/pedidos/$id" params={{ id: o.id }} className="flex items-center gap-3 p-4 hover:bg-muted/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary text-xs font-bold">
                  {o.mesa?.numero ? `M${o.mesa.numero}` : `#${String(o.id).slice(0, 3).toUpperCase()}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{o.cliente?.name ?? (o.mesa_id ? `Mesa ${o.mesa?.numero ?? ""}` : canalLabel[o.canal] ?? "Balcão")}</p>
                  <p className="text-xs text-muted-foreground">{statusLabel[o.status]} · {canalLabel[o.canal] ?? o.canal}</p>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display font-semibold">Pedidos fechados (recentes)</h2>
        </header>
        <ul className="divide-y divide-border">
          {fechados.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nenhum pedido fechado ainda.</li>}
          {fechados.map((o: any) => (
            <li key={o.id}>
              <Link to="/pedidos/$id" params={{ id: o.id }} className="flex items-center gap-3 p-4 hover:bg-muted/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground text-xs font-bold">
                  {o.mesa?.numero ? `M${o.mesa.numero}` : `#${String(o.id).slice(0, 3).toUpperCase()}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{o.cliente?.name ?? (o.mesa_id ? `Mesa ${o.mesa?.numero ?? ""}` : canalLabel[o.canal] ?? "Balcão")}</p>
                  <p className="text-xs text-muted-foreground">{statusLabel[o.status]} · {canalLabel[o.canal] ?? o.canal}</p>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CompanyDashboard() {
  const [granularity, setGranularity] = useState<Granularity>("day");
  const fetchFn = useServerFn(getCompanyDashboardData);
  const range = getPeriodRange(granularity);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", granularity],
    queryFn: () => fetchFn({ data: { granularity, ...range } }),
  });
  useRealtimeInvalidate("pedidos", [["dashboard", granularity]]);
  useRealtimeInvalidate("mesas", [["dashboard", granularity]]);

  if (isLoading && !data) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Erro ao carregar painel: {(error as Error)?.message ?? "desconhecido"}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Operação de hoje 🍔</p>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Painel</h1>
        </div>
        <div className="flex items-center gap-2">
          <PeriodTabs value={granularity} onChange={setGranularity} />
          <Link
            to="/pedidos/novo"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-cta px-3.5 py-2 text-sm font-semibold text-cta-foreground shadow hover:brightness-110 hover:shadow-glow-cta transition-all"
          >
            <Plus className="h-4 w-4" /> Novo pedido
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Faturamento" value={formatBRL(data.valorTotalVendido)} icon={TrendingUp} tone="bg-success/15 text-success" to="/pedidos" />
        <StatCard label="Pedidos ativos" value={data.pedidosAtivos} icon={ShoppingBag} tone="bg-info/15 text-info" to="/pedidos" />
        <StatCard label="Em preparo" value={data.emPreparo} icon={ChefHat} tone="bg-amber-100 text-amber-700" to="/cozinha" />
        <StatCard label="Atrasados" value={data.atrasados} icon={AlarmClock} tone="bg-rose-100 text-rose-600" to="/cozinha" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Mesas abertas" value={data.mesasAbertas} icon={LayoutGrid} tone="bg-primary/10 text-primary" to="/mesas" />
        <StatCard label="Vendas pagas" value={data.vendasConcluidas} icon={BadgeCheck} tone="bg-success/15 text-success" to="/pedidos" />
        <StatCard label="Ticket médio" value={formatBRL(data.ticketMedio)} icon={TrendingUp} tone="bg-primary/10 text-primary" />
        <StatCard label="Top item" value={data.topItem?.name ?? "—"} icon={Trophy} tone="bg-warning/20 text-warning-foreground" />
      </div>

      <ChartSection chart={data.chart} granularity={granularity} onChange={setGranularity} loading={isLoading} />

      <section className="rounded-xl border border-border bg-card p-4 shadow-card">
        <h2 className="font-display font-semibold mb-3">Pedidos por canal</h2>
        <CanalBars data={data.porCanal} />
      </section>

      <Link
        to="/pedidos/novo"
        className="sm:hidden flex items-center justify-between rounded-xl p-4 text-primary-foreground shadow-elevated"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div>
          <p className="text-xs opacity-80">Atalho rápido</p>
          <p className="font-semibold">Novo pedido</p>
        </div>
        <Plus className="h-5 w-5" />
      </Link>

      <section className="rounded-xl border border-border bg-card shadow-card">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display font-semibold">Pedidos ativos</h2>
          <Link to="/pedidos" className="text-xs text-primary inline-flex items-center gap-1">
            Ver todos <ArrowUpRight className="h-3 w-3" />
          </Link>
        </header>
        <ul className="divide-y divide-border">
          {data.recentPedidos.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">Nenhum pedido ativo.</li>
          )}
          {data.recentPedidos.map((o: any) => (
            <li key={o.id} className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary text-xs font-bold">
                #{String(o.id).slice(0, 3).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{o.cliente?.name ?? (o.mesa_id ? "Mesa" : canalLabel[o.canal] ?? "Balcão")}</p>
                <p className="text-xs text-muted-foreground">{statusLabel[o.status]} · {formatBRL(Number(o.total_amount))}</p>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
