import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listPedidos } from "@/lib/pedidos.functions";
import { useAuth } from "@/lib/auth";
import { Loader2, Plus, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_app/pedidos/")({
  component: PedidosList,
  head: () => ({ meta: [{ title: "Pedidos — ORDEX" }] }),
});

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const statusLabel: Record<string, string> = {
  novo: "Novo",
  preparo: "Em preparo",
  pronto: "Pronto",
  pago: "Pago",
  cancelado: "Cancelado",
};
const statusColor: Record<string, string> = {
  novo: "bg-sky-100 text-sky-700",
  preparo: "bg-amber-100 text-amber-700",
  pronto: "bg-emerald-100 text-emerald-700",
  pago: "bg-zinc-200 text-zinc-700",
  cancelado: "bg-rose-100 text-rose-700",
};
const canalLabel: Record<string, string> = {
  salao: "Salão",
  balcao: "Balcão",
  retirada: "Retirada",
  delivery: "Delivery",
};

const LATE_MIN = 25;

type StatusFilter = "todos" | "abertos" | "preparo" | "pronto" | "pago" | "atrasados";

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "abertos", label: "Abertos" },
  { id: "preparo", label: "Em preparo" },
  { id: "pronto", label: "Prontos" },
  { id: "pago", label: "Pagos" },
  { id: "atrasados", label: "Atrasados" },
];

function PedidosList() {
  const { user, isAtendente } = useAuth();
  const [onlyMine, setOnlyMine] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("todos");
  const fetchFn = useServerFn(listPedidos);
  const { data, isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => fetchFn({}),
  });

  const all = (data ?? []) as any[];
  const now = Date.now();

  const filtered = all.filter((p) => {
    if (onlyMine && user?.id && p.user_id !== user.id) return false;
    const ageMin = (now - new Date(p.created_at).getTime()) / 60_000;
    switch (filter) {
      case "todos":
        return true;
      case "abertos":
        return ["novo", "preparo", "pronto"].includes(p.status);
      case "preparo":
        return p.status === "preparo";
      case "pronto":
        return p.status === "pronto";
      case "pago":
        return p.status === "pago";
      case "atrasados":
        return ["novo", "preparo", "pronto"].includes(p.status) && ageMin >= LATE_MIN;
      default:
        return true;
    }
  });

  const counts = {
    todos: all.length,
    abertos: all.filter((p) => ["novo", "preparo", "pronto"].includes(p.status)).length,
    preparo: all.filter((p) => p.status === "preparo").length,
    pronto: all.filter((p) => p.status === "pronto").length,
    pago: all.filter((p) => p.status === "pago").length,
    atrasados: all.filter((p) => ["novo", "preparo", "pronto"].includes(p.status) && (now - new Date(p.created_at).getTime()) / 60_000 >= LATE_MIN).length,
  } as Record<StatusFilter, number>;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando..." : `${filtered.length} ${onlyMine ? "meus" : "no total"}`}
          </p>
        </div>
        <Link to="/pedidos/novo" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo pedido</span>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const isLate = f.id === "atrasados" && counts.atrasados > 0;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-foreground text-background"
                  : isLate
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted border border-transparent"
              }`}
            >
              {f.label}
              <span className={`tabular-nums rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-background/20" : "bg-background/60"}`}>
                {counts[f.id]}
              </span>
            </button>
          );
        })}
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
            return (
              <li key={p.id}>
                <Link to={`/pedidos/${p.id}`} className={`block rounded-xl border bg-card p-3.5 hover:border-primary/40 hover:shadow-sm transition-all ${late ? "border-rose-300" : "border-border"}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-tight truncate">
                          {p.mesa?.numero ? `Mesa ${p.mesa.numero}` : (p.cliente?.name ?? canalLabel[p.canal] ?? p.canal)}
                          {p.cliente?.name && p.mesa?.numero ? <span className="text-muted-foreground font-normal"> · {p.cliente.name}</span> : null}
                        </p>
                        <p className="font-display font-semibold text-primary tabular-nums shrink-0">
                          {formatBRL(p.total_amount)}
                        </p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor[p.status] ?? "bg-muted text-muted-foreground"}`}>
                          {statusLabel[p.status] ?? p.status}
                        </span>
                        <span>{canalLabel[p.canal] ?? p.canal}</span>
                        {p.cliente?.phone && <span className="tabular-nums">{p.cliente.phone}</span>}
                        {p.external_provider === "ifood" && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700"
                            title={`iFood${p.external_order_id ? ` · #${p.external_order_id}` : ""}${p.imported_at ? ` · importado ${new Date(p.imported_at).toLocaleString("pt-BR")}` : ""}`}
                          >
                            iFood
                          </span>
                        )}
                        {p.external_provider && p.external_provider !== "ifood" && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700"
                            title={`Externo · ${p.external_provider}${p.external_order_id ? ` · #${p.external_order_id}` : ""}`}
                          >
                            Externo
                          </span>
                        )}
                        <span className="tabular-nums">{new Date(p.created_at).toLocaleString("pt-BR")}</span>
                        {late && <span className="text-rose-600 font-semibold">ATRASADO</span>}
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
