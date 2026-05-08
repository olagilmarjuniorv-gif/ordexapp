import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPedidos } from "@/lib/pedidos.functions";
import { Loader2, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_app/pedidos/")({
  component: PedidosList,
  head: () => ({ meta: [{ title: "Pedidos — ObraGestor" }] }),
});

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        pending: "bg-amber-100 text-amber-600",
        processing: "bg-sky-100 text-sky-600",
        completed: "bg-green-100 text-green-600",
        cancelled: "bg-neutral-100 text-neutral-500",
    }
    const labels: Record<string, string> = {
        pending: "Pendente",
        processing: "Em processamento",
        completed: "Concluído",
        cancelled: "Cancelado",
    }
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status]}`}>{labels[status] ?? status}</span>
}

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
            {isLoading ? "Carregando..." : `${(data ?? []).length} registrados`}
          </p>
        </div>
      </div>

       {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((p: any) => (
            <li key={p.id}>
                 <Link to={`/pedidos/${p.id}`} className="w-full text-left rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-sm transition-all block">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                            <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                                <p className="font-medium leading-tight truncate">{p.cliente.name}</p>
                                <p className="font-display font-semibold text-primary tabular-nums shrink-0">
                                {formatBRL(p.total_amount)}
                                </p>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <StatusBadge status={p.status} />
                                <span className="tabular-nums">
                                    Criado em {new Date(p.created_at).toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                        </div>
                    </div>
                </Link>
            </li>
          ))}
          {(data ?? []).length === 0 && (
             <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <ShoppingCart className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
            </div>
          )}
        </ul>
      )}
    </div>
  );
}
