import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getPrintComanda } from "@/lib/print.functions";
import { ThermalSheet, ThermalStyles, formatBRL } from "@/components/thermal";

export const Route = createFileRoute("/imprimir/mesa/$id")({
  component: PrintComanda,
  head: () => ({ meta: [{ title: "Imprimir comanda" }] }),
});

function PrintComanda() {
  const { id } = Route.useParams();
  const fn = useServerFn(getPrintComanda);
  const { data, isLoading } = useQuery({
    queryKey: ["print-comanda", id],
    queryFn: () => fn({ data: { mesaId: id } }),
  });

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (isLoading || !data) return <div className="p-6 text-sm">Carregando...</div>;
  const { mesa, pedidos, total, company, atendenteName } = data as any;
  const isFechamento = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("modo") === "fechamento";

  return (
    <>
      <ThermalStyles />
      <ThermalSheet>
        <div className="center bold big">{company.name}</div>
        {company.phone && <div className="center small">{company.phone}</div>}
        <div className="sep" />
        <div className="center bold">{isFechamento ? "FECHAMENTO" : "COMANDA"}</div>
        <div className="row"><span>Mesa</span><span className="bold">{mesa.numero}</span></div>
        <div className="row"><span>Emissão</span><span>{new Date().toLocaleString("pt-BR")}</span></div>
        {mesa.opened_at && <div className="row"><span>Aberta</span><span>{new Date(mesa.opened_at).toLocaleString("pt-BR")}</span></div>}
        {atendenteName && <div className="row"><span>Atendente</span><span>{atendenteName}</span></div>}
        <div className="sep" />
        {pedidos.length === 0 ? (
          <div className="center small">Sem pedidos.</div>
        ) : (
          pedidos.map((p: any) => (
            <div key={p.id} className="item">
              <div className="row small"><span>Pedido #{p.id.slice(0, 4).toUpperCase()}</span><span>{new Date(p.created_at).toLocaleTimeString("pt-BR")}</span></div>
              {((p.items ?? []) as any[]).map((it, i) => (
                <div key={i}>
                  <div className="row"><span>{it.quantity}x {it.name}</span><span>{formatBRL(it.quantity * it.price)}</span></div>
                  {Array.isArray(it.adicionais) && it.adicionais.map((a: any, ai: number) => (
                    <div key={ai} className="small indent">+ {a.name}</div>
                  ))}
                  {it.observacao && <div className="small indent italic">obs: {it.observacao}</div>}
                </div>
              ))}
              {p.observacao && <div className="small italic">Obs: {p.observacao}</div>}
            </div>
          ))
        )}
        <div className="sep" />
        <div className="row big bold"><span>TOTAL</span><span>{formatBRL(total)}</span></div>
        {isFechamento && (
          <>
            <div className="sep" />
            <div className="row small"><span>Taxa entrega</span><span>—</span></div>
            <div className="row small"><span>Descontos</span><span>—</span></div>
            <div className="row bold"><span>A pagar</span><span>{formatBRL(total)}</span></div>
          </>
        )}
        <div className="sep" />
        <div className="center small">{isFechamento ? "Obrigado pela preferência!" : "Comanda não fiscal"}</div>
        <div className="no-print mt">
          <button onClick={() => window.print()} className="btn">Imprimir novamente</button>
        </div>
      </ThermalSheet>
    </>
  );
}
