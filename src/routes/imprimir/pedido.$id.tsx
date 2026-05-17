import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getPrintPedido } from "@/lib/print.functions";
import { ThermalSheet, ThermalStyles, formatBRL, canalLabel } from "@/components/thermal";

export const Route = createFileRoute("/imprimir/pedido/$id")({
  component: PrintPedido,
  head: () => ({ meta: [{ title: "Imprimir pedido" }] }),
});

function PrintPedido() {
  const { id } = Route.useParams();
  const fn = useServerFn(getPrintPedido);
  const { data, isLoading } = useQuery({
    queryKey: ["print-pedido", id],
    queryFn: () => fn({ data: { id } }),
  });

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (isLoading || !data) return <div className="p-6 text-sm">Carregando...</div>;
  const { pedido, company, atendenteName } = data as any;
  const items = (pedido.items ?? []) as any[];
  const mesaNome = pedido.mesa?.numero ? `Mesa ${pedido.mesa.numero}` : canalLabel(pedido.canal, pedido.external_provider);

  return (
    <>
      <ThermalStyles />
      <ThermalSheet>
        <div className="center bold big">{company.name}</div>
        {company.phone && <div className="center small">{company.phone}</div>}
        <div className="sep" />
        <div className="bold">{mesaNome}</div>
        <div className="row"><span>Pedido</span><span>#{pedido.id.slice(0, 6).toUpperCase()}</span></div>
        <div className="row"><span>Horário</span><span>{new Date(pedido.created_at).toLocaleString("pt-BR")}</span></div>
        {atendenteName && <div className="row"><span>Atendente</span><span>{atendenteName}</span></div>}
        {pedido.cliente?.name && <div className="row"><span>Cliente</span><span>{pedido.cliente.name}</span></div>}
        {pedido.cliente?.phone && <div className="row"><span>Tel</span><span>{pedido.cliente.phone}</span></div>}
        {pedido.cliente?.address && <div className="small">{pedido.cliente.address}</div>}
        {pedido.external_provider && (
          <div className="row"><span>{pedido.external_provider.toUpperCase()}</span><span>#{pedido.external_order_id ?? "-"}</span></div>
        )}
        <div className="sep" />
        {items.map((it, i) => (
          <div key={i} className="item">
            <div className="row bold"><span>{it.quantity}x {it.name}</span><span>{formatBRL(it.quantity * it.price)}</span></div>
            {Array.isArray(it.adicionais) && it.adicionais.map((a: any, ai: number) => (
              <div key={ai} className="small indent">+ {a.name} {a.price ? formatBRL(a.price) : ""}</div>
            ))}
            {it.observacao && <div className="small indent italic">obs: {it.observacao}</div>}
          </div>
        ))}
        {pedido.observacao && (
          <>
            <div className="sep" />
            <div className="small italic">Obs: {pedido.observacao}</div>
          </>
        )}
        <div className="sep" />
        <div className="row big bold"><span>TOTAL</span><span>{formatBRL(Number(pedido.total_amount))}</span></div>
        <div className="sep" />
        <div className="center small">Obrigado!</div>
        <div className="no-print mt">
          <button onClick={() => window.print()} className="btn">Imprimir novamente</button>
        </div>
      </ThermalSheet>
    </>
  );
}
