import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, ShoppingBag, TrendingUp, Users, Plus, Building2, ShieldCheck, BadgeCheck, Loader2, ChefHat, AlarmClock, LayoutGrid, Trophy, MessageSquare, Activity, TrendingDown, Clock, Utensils, Bike, PackageCheck, CheckCircle2, Wallet, CircleDollarSign, AlertTriangle, MessageCircle, WifiOff } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { getCompanyDashboardData } from "@/lib/dashboard.functions";
import { getCompanyById } from "@/lib/companies.functions";
import { getSaasOverview } from "@/lib/saas.functions";
import { listPedidos } from "@/lib/pedidos.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { SalesChart } from "@/components/SalesChart";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { type Granularity, GRANULARITY_LABELS, getPeriodRange } from "@/lib/period";
import { getConfiguracoes } from "@/lib/configuracoes.functions";
import { TrialBanner } from "@/components/TrialBanner";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Painel — SaiuPedido" }] }),
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
          <h2 className="font-display font-semibold">Vendas pagas</h2>
          <p className="text-xs text-muted-foreground">Receita confirmada por período</p>
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

function AlertasSection({ atrasados, trial }: { atrasados: number; trial: any }) {
  const itens: { label: string; hint: string; to: string; tone: string }[] = [];
  if (atrasados > 0) {
    itens.push({
      label: `${atrasados} pedido${atrasados === 1 ? "" : "s"} atrasado${atrasados === 1 ? "" : "s"}`,
      hint: "Precisam de atenção na cozinha",
      to: "/cozinha",
      tone: "bg-rose-100 text-rose-700",
    });
  }
  if (trial?.diasRestantes != null && trial.diasRestantes <= 3 && !trial.expirado) {
    itens.push({
      label: `Trial termina em ${trial.diasRestantes} dia${trial.diasRestantes === 1 ? "" : "s"}`,
      hint: "Escolha um plano para continuar",
      to: "/configuracoes?tab=assinatura",
      tone: "bg-amber-100 text-amber-700",
    });
  }
  if (itens.length === 0) return null;
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-card">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-3">Alertas importantes</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {itens.map((a) => (
          <a key={a.label} href={a.to} className="flex items-start gap-2 rounded-md bg-card border border-border p-3 hover:border-amber-300 transition">
            <span className={`flex h-7 w-7 items-center justify-center rounded-md ${a.tone}`}>
              <AlarmClock className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{a.label}</p>
              <p className="text-xs text-muted-foreground">{a.hint}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
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
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Plataforma SaiuPedido</p>
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

function CompanyNameTag() {
  const { companyId, isSuperAdmin } = useAuth();
  const fn = useServerFn(getCompanyById);
  const { data } = useQuery({
    queryKey: ["company-name", companyId],
    queryFn: () => fn({ data: {} }),
    enabled: !!companyId && !isSuperAdmin,
    staleTime: 60_000,
  });
  const name = (data as any)?.name as string | undefined;
  if (!name) return null;
  return <p className="text-sm text-primary font-medium mt-0.5">{name}</p>;
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
          <CompanyNameTag />
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

// ============================================================
// EXECUTIVO — blocos do novo Dashboard
// ============================================================

function AlertasExecutivos({ atrasados, trial, pixPendentes, whatsappOff }: {
  atrasados: number; trial: any; pixPendentes: number; whatsappOff: boolean;
}) {
  const itens: { label: string; hint: string; to: string; tone: string; icon: any }[] = [];
  if (atrasados > 0) {
    itens.push({ label: `${atrasados} pedido${atrasados === 1 ? "" : "s"} atrasado${atrasados === 1 ? "" : "s"}`, hint: "Verifique a cozinha", to: "/cozinha", tone: "bg-rose-100 text-rose-700", icon: AlertTriangle });
  }
  if (whatsappOff) {
    itens.push({ label: "WhatsApp desconectado", hint: "Reconecte em Configurações", to: "/configuracoes?tab=whatsapp", tone: "bg-amber-100 text-amber-700", icon: WifiOff });
  }
  if (pixPendentes > 0) {
    itens.push({ label: `${pixPendentes} PIX pendente${pixPendentes === 1 ? "" : "s"}`, hint: "Acompanhe os pagamentos", to: "/financeiro", tone: "bg-amber-100 text-amber-700", icon: CircleDollarSign });
  }
  if (trial?.diasRestantes != null && trial.diasRestantes <= 3 && !trial.expirado) {
    itens.push({ label: `Trial termina em ${trial.diasRestantes} dia${trial.diasRestantes === 1 ? "" : "s"}`, hint: "Escolha um plano", to: "/configuracoes?tab=assinatura", tone: "bg-amber-100 text-amber-700", icon: AlarmClock });
  }
  if (itens.length === 0) return null;
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-900 mr-1">Alertas</span>
        {itens.map((a) => (
          <a key={a.label} href={a.to} className="inline-flex items-center gap-2 rounded-md bg-card border border-border px-2.5 py-1.5 text-xs font-medium hover:border-amber-300 transition">
            <span className={`flex h-5 w-5 items-center justify-center rounded ${a.tone}`}>
              <a.icon className="h-3 w-3" />
            </span>
            <span>{a.label}</span>
            <span className="text-muted-foreground">· {a.hint}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function OperacaoPipeline({ aguardando, preparo, prontos, emEntrega, finalizados }: {
  aguardando: number; preparo: number; prontos: number; emEntrega: number; finalizados: number;
}) {
  const steps = [
    { label: "Aguardando", value: aguardando, icon: Clock, tone: "bg-amber-100 text-amber-700" },
    { label: "Em preparo", value: preparo, icon: ChefHat, tone: "bg-orange-100 text-orange-700" },
    { label: "Prontos", value: prontos, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700" },
    { label: "Em entrega", value: emEntrega, icon: Bike, tone: "bg-info/15 text-info" },
    { label: "Finalizados", value: finalizados, icon: BadgeCheck, tone: "bg-muted text-muted-foreground" },
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-display font-semibold inline-flex items-center gap-2"><Activity className="h-4 w-4" /> Operação em tempo real</h2>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mt-0.5"><span className="realtime-dot" /> atualização ao vivo</p>
        </div>
        <Link to="/cozinha" className="text-xs text-primary inline-flex items-center gap-1">Ver cozinha <ArrowUpRight className="h-3 w-3" /></Link>
      </header>
      <div className="grid grid-cols-5 gap-2">
        {steps.map((s, i) => (
          <div key={s.label} className="relative">
            <div className="rounded-lg border border-border bg-background p-3 text-center">
              <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md ${s.tone}`}>
                <s.icon className="h-3.5 w-3.5" />
              </div>
              <p className="mt-1.5 font-display text-xl font-bold leading-none">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{s.label}</p>
            </div>
            {i < steps.length - 1 && (
              <span className="hidden lg:block absolute top-1/2 -right-1 h-px w-2 bg-border" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function FinanceiroCard({ recebido, aReceber, pgtoPendentes, pixPendentes }: {
  recebido: number; aReceber: number; pgtoPendentes: number; pixPendentes: number | null;
}) {
  const linhas = [
    { label: "Recebido hoje", value: formatBRL(recebido), tone: "text-success" },
    { label: "A receber", value: formatBRL(aReceber), tone: "text-foreground" },
    { label: "Pgto pendente", value: `${pgtoPendentes} pedido${pgtoPendentes === 1 ? "" : "s"}`, tone: "text-amber-700" },
    { label: "PIX pendentes", value: pixPendentes == null ? "—" : String(pixPendentes), tone: "text-amber-700" },
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <header className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold inline-flex items-center gap-2"><Wallet className="h-4 w-4" /> Financeiro</h2>
        <Link to="/financeiro" className="text-xs text-primary inline-flex items-center gap-1">Detalhes <ArrowUpRight className="h-3 w-3" /></Link>
      </header>
      <ul className="space-y-2">
        {linhas.map((l) => (
          <li key={l.label} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
            <span className="text-muted-foreground">{l.label}</span>
            <span className={`font-semibold tabular-nums ${l.tone}`}>{l.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AtendimentoCard() {
  // Dados ainda não agregados centralmente — placeholder consistente.
  const linhas = [
    { label: "Conversas abertas", value: "—" },
    { label: "Não lidas", value: "—" },
    { label: "Aguardando humano", value: "—" },
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <header className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold inline-flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Atendimento</h2>
        <Link to="/atendimento" className="text-xs text-primary inline-flex items-center gap-1">Abrir <ArrowUpRight className="h-3 w-3" /></Link>
      </header>
      <ul className="space-y-2">
        {linhas.map((l) => (
          <li key={l.label} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
            <span className="text-muted-foreground">{l.label}</span>
            <span className="font-semibold tabular-nums text-muted-foreground">{l.value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground italic">Indicadores agregados em breve.</p>
    </section>
  );
}

function CanaisDonut({ data }: { data: { canal: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const colors = ["hsl(var(--primary))", "#f97316", "#10b981", "#3b82f6", "#a855f7", "#ef4444"];
  if (total === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-4 shadow-card">
        <h2 className="font-display font-semibold mb-3">Canais de venda</h2>
        <p className="text-sm text-muted-foreground">Sem pedidos no período.</p>
      </section>
    );
  }
  let acc = 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  const segs = data.map((d, i) => {
    const pct = d.count / total;
    const dash = pct * c;
    const offset = -acc * c;
    acc += pct;
    return { d, pct, dash, offset, color: colors[i % colors.length] };
  });
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-display font-semibold mb-3">Canais de venda</h2>
      <div className="flex items-center gap-5 flex-wrap">
        <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0 -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
          {segs.map((s, i) => (
            <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="14"
              strokeDasharray={`${s.dash} ${c - s.dash}`} strokeDashoffset={s.offset} />
          ))}
          <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="rotate-90 origin-center fill-foreground font-display font-bold" style={{ fontSize: 14, transform: "rotate(90deg)", transformOrigin: "50px 50px" }}>
            {total}
          </text>
        </svg>
        <ul className="flex-1 min-w-[180px] space-y-1.5">
          {segs.map((s, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {canalLabel[s.d.canal] ?? s.d.canal}
              </span>
              <span className="tabular-nums text-muted-foreground">{s.d.count} · {Math.round(s.pct * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function UltimosPedidosTable({ pedidos }: { pedidos: any[] }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <header className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-display font-semibold">Últimos pedidos</h2>
        <Link to="/pedidos" className="text-xs text-primary inline-flex items-center gap-1">Ver todos <ArrowUpRight className="h-3 w-3" /></Link>
      </header>
      {pedidos.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhum pedido recente.</p>
      ) : (
        <ul className="divide-y divide-border">
          {pedidos.slice(0, 6).map((o: any) => (
            <li key={o.id}>
              <Link to="/pedidos/$id" params={{ id: o.id }} className="flex items-center gap-3 p-3 hover:bg-muted/40">
                <span className="text-[11px] font-bold tabular-nums text-muted-foreground w-12 shrink-0">#{String(o.id).slice(0, 4).toUpperCase()}</span>
                <span className="flex-1 min-w-0 text-sm font-medium truncate">{o.cliente?.name ?? (o.mesa_id ? `Mesa ${o.mesa?.numero ?? ""}` : canalLabel[o.canal] ?? "Balcão")}</span>
                <span className="text-xs text-muted-foreground w-20 truncate hidden sm:block">{canalLabel[o.canal] ?? o.canal}</span>
                <span className="text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 bg-muted text-muted-foreground w-20 text-center">{statusLabel[o.status] ?? o.status}</span>
                <span className="text-sm font-semibold tabular-nums w-20 text-right">{formatBRL(Number(o.total_amount))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UltimasConversasList() {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <header className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-display font-semibold">Últimas conversas</h2>
        <Link to="/atendimento" className="text-xs text-primary inline-flex items-center gap-1">Ver atendimento <ArrowUpRight className="h-3 w-3" /></Link>
      </header>
      <div className="p-6 text-center">
        <MessageCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="mt-2 text-sm text-muted-foreground">Lista consolidada em breve.</p>
        <Link to="/atendimento" className="mt-2 inline-block text-xs text-primary">Abrir caixa de entrada →</Link>
      </div>
    </section>
  );
}

function CompanyDashboard() {
  const granularity: Granularity = "day";
  const fetchFn = useServerFn(getCompanyDashboardData);
  const range = getPeriodRange(granularity);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", granularity],
    queryFn: () => fetchFn({ data: { granularity, ...range } }),
  });
  useRealtimeInvalidate("pedidos", [["dashboard", granularity], ["pedidos"]]);
  useRealtimeInvalidate("mesas", [["dashboard", granularity]]);

  const fetchPedidos = useServerFn(listPedidos);
  const { data: allPedidos = [] } = useQuery({ queryKey: ["pedidos"], queryFn: () => fetchPedidos({}) });

  const getCfg = useServerFn(getConfiguracoes);
  const { data: cfg } = useQuery({
    queryKey: ["dashboard-trial"],
    queryFn: () => getCfg({}),
    staleTime: 60_000,
  });

  if (isLoading && !data) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Erro ao carregar painel: {(error as Error)?.message ?? "desconhecido"}</div>;

  // ----- derivações a partir de listPedidos (mesmo dia) -----
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const pedidosHoje = (allPedidos as any[]).filter((p) => new Date(p.created_at) >= startOfDay);
  const aguardando = (allPedidos as any[]).filter((p) => p.status === "novo").length;
  const emEntrega = (allPedidos as any[]).filter((p) => p.fase_canal === "saiu_entrega").length;
  const pendentesPgto = pedidosHoje.filter((p) => p.status_financeiro !== "pago" && p.status_financeiro !== "cancelado");
  const aReceber = pendentesPgto.reduce((s, p) => s + Number(p.total_amount ?? 0), 0);
  const pgtoPendentes = pendentesPgto.length;

  // WhatsApp / PIX: dados consolidados ainda inexistentes → ocultar / placeholder.
  const whatsappOff = false;
  const pixPendentes: number | null = null;

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Operação de hoje 🍔</p>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Painel</h1>
          <CompanyNameTag />
        </div>
        <Link
          to="/pedidos/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-cta px-3.5 py-2 text-sm font-semibold text-cta-foreground shadow hover:brightness-110 hover:shadow-glow-cta transition-all"
        >
          <Plus className="h-4 w-4" /> Novo pedido
        </Link>
      </div>

      <TrialBanner trial={(cfg as any)?.trial ?? null} />

      {/* BLOCO 8 — Alertas */}
      <AlertasExecutivos
        atrasados={data.atrasados}
        trial={(cfg as any)?.trial ?? null}
        pixPendentes={pixPendentes ?? 0}
        whatsappOff={whatsappOff}
      />

      {/* BLOCO 1 — Resumo do dia */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Faturamento hoje" value={formatBRL(data.valorTotalVendido)} icon={TrendingUp} tone="bg-success/15 text-success" to="/financeiro" />
        <StatCard label="Pedidos hoje" value={pedidosHoje.length} icon={ShoppingBag} tone="bg-primary/10 text-primary" to="/pedidos" />
        <StatCard label="Ticket médio" value={formatBRL(data.ticketMedio)} icon={BadgeCheck} tone="bg-info/15 text-info" />
        <StatCard label="Pedidos ativos" value={data.pedidosAtivos} icon={Activity} tone="bg-amber-100 text-amber-700" to="/cozinha" />
        <StatCard label="Atrasados" value={data.atrasados} icon={AlarmClock} tone="bg-rose-100 text-rose-600" to="/cozinha" />
      </div>

      {/* BLOCO 2 — Operação em tempo real */}
      <OperacaoPipeline
        aguardando={aguardando}
        preparo={data.emPreparo}
        prontos={data.prontos}
        emEntrega={emEntrega}
        finalizados={data.finalizados}
      />

      {/* BLOCOS 3 + 4 — Financeiro + Atendimento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <FinanceiroCard
          recebido={data.valorTotalVendido}
          aReceber={aReceber}
          pgtoPendentes={pgtoPendentes}
          pixPendentes={pixPendentes}
        />
        <AtendimentoCard />
      </div>

      {/* BLOCO 5 — Canais */}
      <CanaisDonut data={data.porCanal} />

      {/* BLOCOS 6 + 7 — Últimos pedidos + Últimas conversas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <UltimosPedidosTable pedidos={data.recentPedidos as any[]} />
        <UltimasConversasList />
      </div>
    </div>
  );
}

