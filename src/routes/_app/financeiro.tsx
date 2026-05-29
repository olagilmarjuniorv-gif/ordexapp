import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, TrendingUp, Wallet, Clock, Truck, Store, BarChart3, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import {
  getFinanceiroOverview,
  type FinPeriod,
  FIN_PERIODS,
} from "@/lib/financeiro.functions";
import { listCompanies } from "@/lib/companies.functions";
import {
  updatePedidoStatusFinanceiro,
  type StatusFinanceiro,
} from "@/lib/pedidos.functions";

export const Route = createFileRoute("/_app/financeiro")({
  component: FinanceiroPage,
  head: () => ({ meta: [{ title: "Financeiro — SaiuPedido" }] }),
});

const PERIOD_LABEL: Record<FinPeriod, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7d": "Últimos 7 dias",
  mes: "Este mês",
};

const FIN_STATUS_LABEL: Record<StatusFinanceiro, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  pagamento_entrega: "Pagamento na entrega",
  pagamento_retirada: "Pagamento na retirada",
  cancelado: "Cancelado",
};

const FIN_STATUS_STYLE: Record<string, string> = {
  pago: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  aguardando_pagamento: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  pagamento_entrega: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  pagamento_retirada: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

type StatusFilter = "todos" | StatusFinanceiro;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pago", label: "Pago" },
  { value: "aguardando_pagamento", label: "Aguardando" },
  { value: "pagamento_entrega", label: "Pag. entrega" },
  { value: "pagamento_retirada", label: "Pag. retirada" },
];

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}

function FinanceiroPage() {
  const { isAdmin, isSuperAdmin, role, loading } = useAuth();
  const queryClient = useQueryClient();

  const getOverviewFn = useServerFn(getFinanceiroOverview);
  const listCompaniesFn = useServerFn(listCompanies);
  const updateFinFn = useServerFn(updatePedidoStatusFinanceiro);

  const [period, setPeriod] = useState<FinPeriod>("hoje");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const canView = isAdmin || role === "atendente";
  const canEdit = isAdmin;

  const companiesQuery = useQuery({
    queryKey: ["companies-list"],
    queryFn: () => listCompaniesFn({ data: {} }),
    enabled: !!isSuperAdmin,
    staleTime: 60_000,
  });

  const overviewQuery = useQuery({
    queryKey: ["financeiro", period, selectedCompanyId],
    queryFn: () =>
      getOverviewFn({
        data: { period, companyId: isSuperAdmin ? selectedCompanyId : null },
      }),
    enabled: canView && (!isSuperAdmin || !!selectedCompanyId),
    staleTime: 10_000,
  });

  useRealtimeInvalidate("pedidos", [["financeiro", period, selectedCompanyId]]);

  const cards = overviewQuery.data?.cards;
  const pedidos = useMemo(() => {
    const list = (overviewQuery.data?.pedidos ?? []) as any[];
    if (statusFilter === "todos") return list;
    return list.filter((p) => p.status_financeiro === statusFilter);
  }, [overviewQuery.data, statusFilter]);

  async function setStatus(id: string, next: StatusFinanceiro) {
    try {
      await updateFinFn({ data: { id, status_financeiro: next } });
      toast.success("Status financeiro atualizado");
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao atualizar");
    }
  }

  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canView) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Visão simples de pedidos pagos, pendentes e valores a receber.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin ? (
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={selectedCompanyId ?? ""}
              onChange={(e) => setSelectedCompanyId(e.target.value || null)}
            >
              <option value="">Selecionar empresa…</option>
              {(companiesQuery.data ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}

          <div className="flex gap-1 rounded-md border border-border bg-card p-1">
            {FIN_PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={
                  "px-3 py-1.5 text-xs rounded " +
                  (period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Cards */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <CardKpi
          icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
          label="Faturamento"
          value={brl(cards?.faturamento ?? 0)}
          hint="pedidos pagos no período"
        />
        <CardKpi
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          label="Pedidos pagos"
          value={String(cards?.pedidos_pagos ?? 0)}
        />
        <CardKpi
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          label="Aguardando pagamento"
          value={brl(cards?.aguardando ?? 0)}
        />
        <CardKpi
          icon={<Truck className="h-5 w-5 text-blue-500" />}
          label="A receber na entrega"
          value={brl(cards?.a_receber_entrega ?? 0)}
        />
        <CardKpi
          icon={<Store className="h-5 w-5 text-purple-500" />}
          label="A receber na retirada"
          value={brl(cards?.a_receber_retirada ?? 0)}
        />
        <CardKpi
          icon={<BarChart3 className="h-5 w-5 text-primary" />}
          label="Ticket médio"
          value={brl(cards?.ticket_medio ?? 0)}
          hint="média de pedidos pagos"
        />
      </section>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={
              "px-3 py-1.5 text-xs rounded-full border " +
              (statusFilter === s.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Pedido</th>
                <th className="text-left px-3 py-2">Cliente</th>
                <th className="text-left px-3 py-2">Canal</th>
                <th className="text-left px-3 py-2">Pagamento</th>
                <th className="text-left px-3 py-2">Financeiro</th>
                <th className="text-left px-3 py-2">Operacional</th>
                <th className="text-right px-3 py-2">Valor</th>
                <th className="text-left px-3 py-2">Data</th>
                {canEdit ? <th className="text-right px-3 py-2">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {overviewQuery.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                    Carregando…
                  </td>
                </tr>
              ) : pedidos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum pedido no período.
                  </td>
                </tr>
              ) : (
                pedidos.map((p: any) => {
                  const sf = (p.status_financeiro ?? "aguardando_pagamento") as StatusFinanceiro;
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">
                        #{String(p.id).slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-3 py-2">{p.cliente?.name ?? "—"}</td>
                      <td className="px-3 py-2 capitalize">{p.canal ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {p.forma_pagamento ? p.forma_pagamento.replace(/_/g, " ") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] " +
                            (FIN_STATUS_STYLE[sf] ?? FIN_STATUS_STYLE.aguardando_pagamento)
                          }
                        >
                          {FIN_STATUS_LABEL[sf]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs capitalize text-muted-foreground">
                        {p.status}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {brl(Number(p.total_amount ?? 0))}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString("pt-BR")}
                      </td>
                      {canEdit ? (
                        <td className="px-3 py-2 text-right">
                          {sf !== "pago" ? (
                            <button
                              onClick={() => setStatus(p.id, "pago")}
                              className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            >
                              Marcar pago
                            </button>
                          ) : (
                            <button
                              onClick={() => setStatus(p.id, "aguardando_pagamento")}
                              className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/70"
                            >
                              Reabrir
                            </button>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CardKpi(props: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{props.label}</span>
        {props.icon}
      </div>
      <div className="mt-2 text-2xl font-semibold">{props.value}</div>
      {props.hint ? <div className="mt-1 text-[11px] text-muted-foreground">{props.hint}</div> : null}
    </div>
  );
}
