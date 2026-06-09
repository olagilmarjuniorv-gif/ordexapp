import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listPedidos } from "@/lib/pedidos.functions";
import { useAuth } from "@/lib/auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { Loader2, Plus, ShoppingBag, CircleDot, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_app/pedidos/")({
  component: PedidosList,
  head: () => ({ meta: [{ title: "Pedidos — SaiuPedido" }] }),
});

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// status "pago" legado é tratado como finalizado na UI
const statusLabel: Record<string, string> = {
  novo: "Novo",
  preparo: "Em preparo",
  pronto: "Pronto",
  finalizado: "Finalizado",
  pago: "Finalizado",
  cancelado: "Cancelado",
};
const statusColor: Record<string, string> = {
  novo: "bg-realtime/15 text-realtime",
  preparo: "bg-warning/20 text-warning-foreground",
  pronto: "bg-success/15 text-success",
  finalizado: "bg-muted text-muted-foreground",
  pago: "bg-muted text-muted-foreground",
  cancelado: "bg-destructive/15 text-destructive",
};
const canalLabel: Record<string, string> = {
  salao: "Salão",
  balcao: "Balcão",
  retirada: "Retirada",
  delivery: "Delivery",
};

const LATE_MIN = 25;

type StatusFilter = "todos" | "novo" | "preparo" | "pronto" | "finalizado" | "cancelado" | "atrasado";
type PagamentoFilter = "todos" | "pago" | "aguardando" | "entrega" | "retirada";
type PeriodoFilter = "hoje" | "semana" | "mes" | "ano";

const FIN_LABEL: Record<string, string> = {
  aguardando_pagamento: "Aguardando",
  pago: "Pago",
  pagamento_entrega: "Pagamento na entrega",
  pagamento_retirada: "Pagamento na retirada",
  cancelado: "Cancelado",
};
const FIN_DOT: Record<string, string> = {
  aguardando_pagamento: "text-amber-500",
  pago: "text-emerald-500",
  pagamento_entrega: "text-sky-500",
  pagamento_retirada: "text-sky-500",
  cancelado: "text-muted-foreground",
};

function periodoStart(p: PeriodoFilter): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "hoje") return d;
  if (p === "semana") { d.setDate(d.getDate() - 7); return d; }
  if (p === "mes") { d.setMonth(d.getMonth() - 1); return d; }
  d.setFullYear(d.getFullYear() - 1);
  return d;
}

function PedidosList() {
  const { user, isAtendente } = useAuth();
  const [onlyMine, setOnlyMine] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [pagamento, setPagamento] = useState<PagamentoFilter>("todos");
  const [periodo, setPeriodo] = useState<PeriodoFilter>("hoje");
  const fetchFn = useServerFn(listPedidos);
  const { data, isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => fetchFn({}),
  });

  useRealtimeInvalidate("pedidos", [["pedidos"]]);

  const all = (data ?? []) as any[];
  const now = Date.now();
  const startTs = periodoStart(periodo).getTime();

  const filtered = all.filter((p) => {
    if (onlyMine && user?.id && p.user_id !== user.id) return false;
    if (new Date(p.created_at).getTime() < startTs) return false;
    const ageMin = (now - new Date(p.created_at).getTime()) / 60_000;
    const aberto = ["novo", "preparo", "pronto"].includes(p.status);

    if (status === "atrasado") {
      if (!(aberto && ageMin >= LATE_MIN)) return false;
    } else if (status === "finalizado") {
      if (!["finalizado", "pago"].includes(p.status)) return false;
    } else if (status !== "todos") {
      if (p.status !== status) return false;
    }

    if (pagamento !== "todos") {
      const map: Record<PagamentoFilter, string | null> = {
        todos: null,
        pago: "pago",
        aguardando: "aguardando_pagamento",
        entrega: "pagamento_entrega",
        retirada: "pagamento_retirada",
      };
      if (p.status_financeiro !== map[pagamento]) return false;
    }

    return true;
  });

  const atrasadosCount = all.filter((p) => ["novo", "preparo", "pronto"].includes(p.status) && (now - new Date(p.created_at).getTime()) / 60_000 >= LATE_MIN).length;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <span className="realtime-dot" />
            {isLoading ? "Carregando..." : `${filtered.length} ${onlyMine ? "meus" : "no total"} · tempo real`}
            {atrasadosCount > 0 && <span className="text-destructive font-semibold">· {atrasadosCount} atrasado{atrasadosCount > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <Link to="/pedidos/novo" className="inline-flex items-center gap-2 rounded-lg bg-cta px-3 py-2 text-sm font-semibold text-cta-foreground shadow hover:brightness-110 hover:shadow-glow-cta transition-all">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo pedido</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="todos">Todos</option>
            <option value="novo">Novo</option>
            <option value="preparo">Em preparo</option>
            <option value="pronto">Pronto</option>
            <option value="finalizado">Finalizado</option>
            <option value="cancelado">Cancelado</option>
            <option value="atrasado">Atrasado</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Pagamento</span>
          <select
            value={pagamento}
            onChange={(e) => setPagamento(e.target.value as PagamentoFilter)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="todos">Todos</option>
            <option value="pago">Pago</option>
            <option value="aguardando">Aguardando</option>
            <option value="entrega">Na entrega</option>
            <option value="retirada">Na retirada</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Período</span>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as PeriodoFilter)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="hoje">Hoje</option>
            <option value="semana">Semana</option>
            <option value="mes">Mês</option>
            <option value="ano">Ano</option>
          </select>
        </label>
      </div>

      {(isAtendente || user) && (
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setOnlyMine(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!onlyMine ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setOnlyMine(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${onlyMine ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Meus pedidos
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p: any) => {
            const ageMin = (now - new Date(p.created_at).getTime()) / 60_000;
            const late = ["novo", "preparo", "pronto"].includes(p.status) && ageMin >= LATE_MIN;
            const titulo = p.mesa?.numero
              ? `Mesa ${p.mesa.numero}${p.cliente?.name ? ` • ${p.cliente.name}` : ""}`
              : (p.cliente?.name ?? canalLabel[p.canal] ?? p.canal);
            return (
              <li key={p.id} className="order-enter">
                <Link to="/pedidos/$id" params={{ id: p.id }} className={`block card-premium p-3.5 ${late ? "!border-destructive/50" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${p.status === "novo" ? "bg-realtime/15 text-realtime" : "bg-primary-soft text-primary"}`}>
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-tight truncate">{titulo}</p>
                        <p className="font-display font-semibold text-primary tabular-nums shrink-0">
                          {formatBRL(p.total_amount)}
                        </p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor[p.status] ?? "bg-muted text-muted-foreground"}`}>
                          {statusLabel[p.status] ?? p.status}
                        </span>
                        {p.status_financeiro && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${FIN_DOT[p.status_financeiro] ?? "text-muted-foreground"}`}>
                            <CircleDot className="h-3 w-3" />
                            {FIN_LABEL[p.status_financeiro] ?? p.status_financeiro}
                          </span>
                        )}
                        <span className="text-muted-foreground">{canalLabel[p.canal] ?? p.canal}</span>
                        {p.external_provider === "ifood" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">iFood</span>
                        )}
                        <span className="text-muted-foreground tabular-nums ml-auto">{new Date(p.created_at).toLocaleString("pt-BR")}</span>
                        {late && <span className="text-destructive font-semibold">ATRASADO</span>}
                      </div>
                      {p.observacao && (
                        <p className="mt-1 text-xs italic text-muted-foreground truncate">"{p.observacao}"</p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido neste filtro.</p>
            </div>
          )}
        </ul>
      )}
    </div>
  );
}
