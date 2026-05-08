import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrcamento, updateOrcamentoStatus } from "@/lib/orcamentos.functions";
import { createPedidoFromOrcamento } from "@/lib/pedidos.functions";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Send, Check, X, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/orcamentos/$id")({
  component: OrcamentoDetail,
  head: p => ({ meta: [{ title: `Orçamento #${p.params.id.slice(0,6)}` }] }),
});

function formatBRL(value: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function OrcamentoDetail() {
    const qc = useQueryClient();
    const navigate = useNavigate();
    const { id } = Route.useParams();
    const getFn = useServerFn(getOrcamento);
    const statusFn = useServerFn(updateOrcamentoStatus);
    const approveFn = useServerFn(createPedidoFromOrcamento);

    const { data: orcRaw, isLoading, error } = useQuery({ 
        queryKey: ['orcamento', id], 
        queryFn: () => getFn({ data: { id } }) 
    });
    const orcamento = orcRaw as any;

    const statusM = useMutation({
        mutationFn: (vars: { status: any }) => statusFn({ data: { id, status: vars.status } }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamento', id] }),
        onError: (e: any) => toast.error(e?.message ?? "Erro"),
    });

     const approveM = useMutation({
        mutationFn: () => approveFn({ data: { orcamento_id: id } }),
        onSuccess: (res: any) => {
            toast.success("Pedido criado com sucesso!");
            qc.invalidateQueries({ queryKey: ['orcamentos'] });
            qc.invalidateQueries({ queryKey: ['pedidos'] });
            navigate({ to: `/pedidos/${res.id}` });
        },
        onError: (e: any) => toast.error(e?.message ?? "Erro ao aprovar"),
    });

    if (isLoading || !orcamento) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin"/></div>
    if (error) return <div className="text-center text-destructive py-12">{(error as Error).message}</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Link to="/orcamentos" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Voltar para Orçamentos
            </Link>
            
            <div className="bg-card border rounded-2xl p-6 space-y-6">
                 <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="font-display text-2xl font-bold">Orçamento #{id.slice(0, 6)}</h1>
                        <p className="text-sm text-muted-foreground">Cliente: {orcamento.cliente.name}</p>
                        <p className="text-sm text-muted-foreground">Data: {new Date(orcamento.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                        {/* Status badge and actions based on status */}
                        <div className="text-right">
                             <p className="text-sm font-bold">Status: {orcamento.status}</p>
                        </div>
                    </div>
                </div>

                <div>
                    <h2 className="font-semibold mb-2">Itens do Orçamento</h2>
                    <ul className="divide-y divide-border border-y border-border">
                        {orcamento.items.map((item: any) => (
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
                        Total: {formatBRL(orcamento.total_amount)}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border pt-6">
                    {orcamento.status === 'draft' && (
                         <button onClick={() => statusM.mutate({ status: 'sent' })} className="btn-secondary"><Send className="h-4 w-4"/> Marcar como Enviado</button>
                    )}
                     {orcamento.status === 'sent' && (
                        <>
                            <button onClick={() => statusM.mutate({ status: 'cancelled' })} className="btn-secondary"><X className="h-4 w-4"/> Cancelar</button>
                            <button onClick={() => approveM.mutate()} disabled={approveM.isPending} className="btn-primary">
                                {approveM.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>} Aprovar e Criar Pedido
                            </button>
                        </>
                    )}
                     {orcamento.status === 'approved' && (
                         <p className="text-sm text-green-600 font-medium">Orçamento aprovado e convertido em pedido.</p>
                    )}
                </div>

            </div>
        </div>
    )
}

// Helper to create consistent button styles
const btnBase = " inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-70 ";
const btnPrimary = btnBase + " bg-primary text-primary-foreground ";
const btnSecondary = btnBase + " bg-muted text-muted-foreground hover:bg-muted/80 ";

// Dummy components to make code compile
function Button({ className, children, ...props }: any) { return <button className={className} {...props}>{children}</button> }
