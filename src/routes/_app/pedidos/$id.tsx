import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPedido, updatePedidoStatus, type PedidoStatus } from "@/lib/pedidos.functions";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ChefHat, Bell, BadgeCheck, X } from "lucide-react";

export const Route = createFileRoute("/_app/pedidos/$id")({
  component: PedidoDetail,
  head: (p) => ({ meta: [{ title: `Pedido #${p.params.id.slice(0, 6)}` }] }),
});

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const canalLabel: Record<string, string> = {
  salao: "Salão",
  balcao: "Balcão",
  retirada: "Retirada",
  delivery: "Delivery",
  whatsapp: "WhatsApp",
};

function PedidoDetail() {
  const qc = useQueryClient();
  const { id } = Route.useParams();
  const getFn = useServerFn(getPedido);
  const statusFn = useServerFn(updatePedidoStatus);

  const { data: pedRaw, isLoading, error } = useQuery({
    queryKey: ["pedido", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const pedido = pedRaw as any;

  const statusM = useMutation({
    mutationFn: (status: PedidoStatus) => statusFn({ data: { id, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedido", id] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  if (isLoading || !pedido)
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (error) return <div className="text-center text-destructive py-12">{(error as Error).message}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/pedidos" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="bg-card border rounded-2xl p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Pedido #{id.slice(0, 6)}</h1>
            <p className="text-sm text-muted-foreground">
              {pedido.cliente?.name ? `Cliente: ${pedido.cliente.name}` : "Sem cliente vinculado"}
            </p>
            <p className="text-sm text-muted-foreground">Canal: {canalLabel[pedido.canal] ?? pedido.canal}</p>
            <p className="text-sm text-muted-foreground">Aberto em: {new Date(pedido.created_at).toLocaleString("pt-BR")}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-right uppercase tracking-wide">{pedido.status}</p>
          </div>
        </div>

        {pedido.observacao && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <span className="font-semibold">Observação: </span>{pedido.observacao}
          </div>
        )}

        <div>
          <h2 className="font-semibold mb-2">Itens</h2>
          <ul className="divide-y divide-border border-y border-border">
            {(pedido.items ?? []).map((item: any, i: number) => (
              <li key={`${item.product_id}-${i}`} className="flex justify-between items-center p-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} x {formatBRL(item.price)}
                    {item.observacao ? ` · ${item.observacao}` : ""}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">{formatBRL(item.quantity * item.price)}</p>
              </li>
            ))}
          </ul>
          <div className="flex justify-end p-3 font-bold text-lg">
            Total: {formatBRL(pedido.total_amount)}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-6">
          {pedido.status === "novo" && (
            <>
              <button onClick={() => statusM.mutate("cancelado")} className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-semibold">
                <X className="h-4 w-4" /> Cancelar
              </button>
              <button onClick={() => statusM.mutate("preparo")} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white">
                <ChefHat className="h-4 w-4" /> Iniciar preparo
              </button>
            </>
          )}
          {pedido.status === "preparo" && (
            <button onClick={() => statusM.mutate("pronto")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white">
              <Bell className="h-4 w-4" /> Marcar como pronto
            </button>
          )}
          {pedido.status === "pronto" && (
            <button onClick={() => statusM.mutate("pago")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
              <BadgeCheck className="h-4 w-4" /> Marcar como pago
            </button>
          )}
          {pedido.status === "pago" && <p className="text-sm text-emerald-600 font-medium">Pedido finalizado.</p>}
          {pedido.status === "cancelado" && <p className="text-sm text-muted-foreground font-medium">Pedido cancelado.</p>}
        </div>
      </div>
    </div>
  );
}
