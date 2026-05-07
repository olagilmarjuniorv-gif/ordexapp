import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, FileText, ShoppingBag, TrendingUp, Users, Plus } from "lucide-react";
import { customerById, formatBRL, orders, quotes } from "@/lib/mock-data";
import { OrderBadge, QuoteBadge } from "@/components/StatusBadge";
import { WhatsappButton } from "@/components/WhatsappButton";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Painel — ObraGestor" }] }),
});

function Dashboard() {
  const totalHoje = orders.reduce((s, o) => s + o.total, 0);
  const aprovados = quotes.filter((q) => q.status === "aprovado").length;
  const pendentes = quotes.filter((q) => q.status === "enviado").length;

  const stats = [
    { label: "Vendas hoje", value: formatBRL(totalHoje), icon: TrendingUp, tone: "primary" as const },
    { label: "Pedidos abertos", value: orders.filter((o) => o.status !== "entregue").length, icon: ShoppingBag, tone: "info" as const },
    { label: "Orçamentos enviados", value: pendentes, icon: FileText, tone: "warning" as const },
    { label: "Aprovados", value: aprovados, icon: Users, tone: "success" as const },
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
              <span className={`flex h-7 w-7 items-center justify-center rounded-md bg-${s.tone}/10 text-${s.tone}`}>
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
          {quotes.slice(0, 4).map((q) => {
            const c = customerById(q.customerId);
            return (
              <li key={q.id} className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary text-xs font-bold">
                  {q.number.slice(-3)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c?.name}</p>
                  <p className="text-xs text-muted-foreground">{q.number} · {q.createdAt}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatBRL(q.total)}</p>
                  <div className="mt-1"><QuoteBadge status={q.status} /></div>
                </div>
              </li>
            );
          })}
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
          {orders.slice(0, 3).map((o) => {
            const c = customerById(o.customerId);
            return (
              <li key={o.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c?.name}</p>
                  <p className="text-xs text-muted-foreground">{o.number} · {formatBRL(o.total)}</p>
                </div>
                <OrderBadge status={o.status} />
                <WhatsappButton phone={c?.phone} variant="ghost" label="" message={`Olá ${c?.name}, atualização do pedido ${o.number}.`} />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
