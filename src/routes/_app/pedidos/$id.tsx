import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPedido,
  updatePedidoStatus,
  updatePedidoStatusFinanceiro,
  voltarParaCozinha,
  FORMAS_PAGAMENTO,
  STATUS_FINANCEIRO,
  type PedidoStatus,
  type FormaPagamento,
  type StatusFinanceiro,
} from "@/lib/pedidos.functions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ChefHat, Bell, BadgeCheck, X, Printer, Receipt, Wallet, Undo2, CheckCircle2 } from "lucide-react";

const FORMA_LABEL: Record<FormaPagamento, string> = {
  pix_online: "Pix online",
  dinheiro: "Dinheiro",
  credito_presencial: "Crédito presencial",
  debito_presencial: "Débito presencial",
  pix_presencial: "Pix presencial",
  pagamento_entrega: "Pagamento na entrega",
  pagamento_retirada: "Pagamento na retirada",
};
const FIN_LABEL: Record<StatusFinanceiro, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  pagamento_entrega: "Pagamento na entrega",
  pagamento_retirada: "Pagamento na retirada",
  cancelado: "Cancelado",
};

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
  const { isAdmin, isAtendente } = useAuth();
  const canEditFinanceiro = isAdmin || isAtendente;
  const getFn = useServerFn(getPedido);
  const statusFn = useServerFn(updatePedidoStatus);
  const finFn = useServerFn(updatePedidoStatusFinanceiro);
  const voltarFn = useServerFn(voltarParaCozinha);

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

  const finM = useMutation({
    mutationFn: (vars: { status_financeiro: StatusFinanceiro; forma_pagamento?: FormaPagamento | null }) =>
      finFn({ data: { id, ...vars } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedido", id] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Pagamento atualizado");
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
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold">Pedido #{id.slice(0, 6)}</h1>
              {pedido.external_provider === "ifood" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">iFood</span>
              )}
              {pedido.external_provider && pedido.external_provider !== "ifood" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500 text-white">{pedido.external_provider}</span>
              )}
              {pedido.external_order_id && (
                <span className="text-xs text-muted-foreground">#{pedido.external_order_id}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {pedido.mesa_id ? "Mesa" : "Origem"}: {canalLabel[pedido.canal] ?? pedido.canal}
            </p>
            <p className="text-sm text-muted-foreground">
              {pedido.cliente?.name ? `Cliente: ${pedido.cliente.name}` : "Sem cliente vinculado"}
              {pedido.cliente?.phone ? ` · ${pedido.cliente.phone}` : ""}
            </p>
            {pedido.cliente?.address && (
              <p className="text-sm text-muted-foreground">Endereço: {pedido.cliente.address}</p>
            )}
            <p className="text-sm text-muted-foreground">Aberto em: {new Date(pedido.created_at).toLocaleString("pt-BR")}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-sm font-bold text-right uppercase tracking-wide">{pedido.status}</p>
            <a
              href={`/imprimir/pedido/${id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </a>
            {pedido.mesa_id && (
              <Link
                to="/mesas/$id"
                params={{ id: pedido.mesa_id }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <Receipt className="h-3.5 w-3.5" /> Ver comanda
              </Link>
            )}
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

        {/* Pagamento */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Pagamento</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Forma de pagamento</p>
              <p className="font-medium">
                {pedido.forma_pagamento ? (FORMA_LABEL[pedido.forma_pagamento as FormaPagamento] ?? pedido.forma_pagamento) : "Não definida"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status financeiro</p>
              <p className="font-medium">
                {FIN_LABEL[pedido.status_financeiro as StatusFinanceiro] ?? pedido.status_financeiro}
              </p>
            </div>
          </div>

          {canEditFinanceiro && pedido.status_financeiro !== "cancelado" && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <select
                value={pedido.forma_pagamento ?? ""}
                onChange={(e) =>
                  finM.mutate({
                    status_financeiro: pedido.status_financeiro as StatusFinanceiro,
                    forma_pagamento: (e.target.value || null) as FormaPagamento | null,
                  })
                }
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">— Sem forma —</option>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f} value={f}>{FORMA_LABEL[f]}</option>
                ))}
              </select>
              <select
                value={pedido.status_financeiro ?? ""}
                onChange={(e) =>
                  finM.mutate({ status_financeiro: e.target.value as StatusFinanceiro })
                }
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              >
                {STATUS_FINANCEIRO.map((s) => (
                  <option key={s} value={s}>{FIN_LABEL[s]}</option>
                ))}
              </select>
              {pedido.status_financeiro !== "pago" && (
                <button
                  onClick={() => finM.mutate({ status_financeiro: "pago" })}
                  disabled={finM.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <BadgeCheck className="h-3.5 w-3.5" /> Marcar pago
                </button>
              )}
            </div>
          )}
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
