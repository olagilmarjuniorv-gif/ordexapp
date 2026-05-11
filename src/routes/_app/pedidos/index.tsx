import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPedidos } from "@/lib/pedidos.functions";
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
  whatsapp: "WhatsApp",
};

function PedidosList() {
  const fetchFn = useServerFn(listPedidos);
  const { data, isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => fetchFn({}),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando..." : `${(data ?? []).length} no total`}
          </p>
        </div>
        <Link to="/pedidos/novo" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo pedido</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((p: any) => (
            <li key={p.id}>
              <Link to={`/pedidos/${p.id}`} className="block rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight truncate">
                        {p.cliente?.name ?? (p.mesa_id ? "Mesa" : "Balcão")}
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
                      <span className="tabular-nums">{new Date(p.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
          {(data ?? []).length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido ainda.</p>
              <Link to="/pedidos/novo" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card">
                <Plus className="h-4 w-4" /> Criar pedido
              </Link>
            </div>
          )}
        </ul>
      )}
    </div>
  );
}
