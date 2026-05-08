import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPedido, updatePedidoStatus } from "@/lib/pedidos.functions";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Truck, Check, X, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_app/pedidos/$id")({
  component: PedidoDetail,
  head: p => ({ meta: [{ title: `Pedido #${p.params.id.slice(0,6)}` }] }),
});

function formatBRL(value: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function PedidoDetail() {
    const qc = useQueryClient();
    const { id } = Route.useParams();
    const getFn = useServerFn(getPedido);
    const statusFn = useServerFn(updatePedidoStatus);

    const { data: pedido, isLoading, error } = useQuery({ 
        queryKey: ['pedido', id], 
        queryFn: () => getFn({ data: { id } }) 
    });

    const statusM = useMutation({
        mutationFn: (vars: { status: any }) => statusFn({ data: { id, status: vars.status } }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['pedido', id] }),
        onError: (e: any) => toast.error(e?.message ?? "Erro"),
    });

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin"/></div>
    if (error) return <div className="text-center text-destructive py-12">{error.message}</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Link to="/pedidos" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Voltar para Pedidos
            </Link>
            
            <div className="bg-card border rounded-2xl p-6 space-y-6">
                 <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="font-display text-2xl font-bold">Pedido #{id.slice(0, 6)}</h1>
                        <p className="text-sm text-muted-foreground">Cliente: {pedido.cliente.name}</p>
                        <p className="text-sm text-muted-foreground">Data: {new Date(pedido.created_at).toLocaleDateString('pt-BR')}</p>
                        {pedido.orcamento_id && <Link to={`/orcamentos/${pedido.orcamento_id}`} className="text-sm text-primary hover:underline">Ver orçamento original</Link>}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-right">Status: {pedido.status}</p>
                    </div>
                </div>

                <div>
                    <h2 className="font-semibold mb-2">Itens do Pedido</h2>
                    <ul className="divide-y divide-border border-y border-border">
                        {pedido.items.map((item: any) => (
                            <li key={item.product_id} className="flex justify-between items-center p-3">
                                <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">{item.quantity} x {formatBRL(item.price)}</p>
                                </div>
                                <p className="font-semibold tabular-nums">{formatBRL(item.quantity * item.price)}</p>
                            </li>
                        ))}
                    </ul>
                    <div className="flex justify-end p-3 font-bold text-lg">
                        Total: {formatBRL(pedido.total_amount)}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border pt-6">
                    {pedido.status === 'pending' && (
                        <>
                             <button onClick={() => statusM.mutate({ status: 'cancelled' })} className="btn-secondary"><X className="h-4 w-4"/> Cancelar</button>
                             <button onClick={() => statusM.mutate({ status: 'processing' })} className="btn-secondary"><Truck className="h-4 w-4"/> Iniciar Processamento</button>
                        </>
                    )}
                     {pedido.status === 'processing' && (
                         <button onClick={() => statusM.mutate({ status: 'completed' })} className="btn-primary"><Check className="h-4 w-4"/> Marcar como Concluído</button>
                    )}
                     {pedido.status === 'completed' && (
                         <p className="text-sm text-green-600 font-medium">Pedido concluído.</p>
                    )}
                     {pedido.status === 'cancelled' && (
                         <p className="text-sm text-muted-foreground font-medium">Pedido cancelado.</p>
                    )}
                </div>
            </div>
        </div>
    )
}

// Dummy button components for styling
const btnBase = " inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-70 ";
const btnPrimary = btnBase + " bg-primary text-primary-foreground ";
const btnSecondary = btnBase + " bg-muted text-muted-foreground hover:bg-muted/80 ";
