import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Receipt, DollarSign, Unlock, Plus, Loader2, Clock, Printer } from "lucide-react";
import {
  getComandaMesa,
  fecharContaMesa,
  pagarMesa,
  liberarMesa,
} from "@/lib/mesas.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/mesas/$id")({
  component: ComandaPage,
  head: () => ({ meta: [{ title: "Comanda — ORDEX" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  preparo: "Em preparo",
  pronto: "Pronto",
  pago: "Pago",
};

function elapsed(opened_at: string | null) {
  if (!opened_at) return null;
  const m = Math.floor((Date.now() - new Date(opened_at).getTime()) / 60000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h${(m % 60).toString().padStart(2, "0")}`;
}

function ComandaPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getComandaMesa);
  const fecharFn = useServerFn(fecharContaMesa);
  const pagarFn = useServerFn(pagarMesa);
  const liberarFn = useServerFn(liberarMesa);

  const { data, isLoading, error } = useQuery({
    queryKey: ["comanda", id],
    queryFn: () => fetchFn({ data: { mesaId: id } }),
  });

  useRealtimeInvalidate("pedidos", [["comanda", id], ["mesas"]]);
  useRealtimeInvalidate("mesas", [["comanda", id]]);

  const fecharM = useMutation({
    mutationFn: () => fecharFn({ data: { mesaId: id } }),
    onSuccess: () => {
      toast.success("Conta fechada — aguardando pagamento");
      qc.invalidateQueries({ queryKey: ["comanda", id] });
      qc.invalidateQueries({ queryKey: ["mesas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const pagarM = useMutation({
    mutationFn: () => pagarFn({ data: { mesaId: id } }),
    onSuccess: () => {
      toast.success("Mesa paga e liberada");
      qc.invalidateQueries({ queryKey: ["comanda", id] });
      qc.invalidateQueries({ queryKey: ["mesas"] });
      nav({ to: "/mesas" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao pagar"),
  });

  const liberarM = useMutation({
    mutationFn: () => liberarFn({ data: { mesaId: id } }),
    onSuccess: () => {
      toast.success("Mesa liberada");
      qc.invalidateQueries({ queryKey: ["mesas"] });
      nav({ to: "/mesas" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Erro ao carregar comanda.</div>;
  }

  const { mesa, pedidos, totalAberto } = data as any;
  const time = elapsed(mesa.opened_at);
  const semPedidos = pedidos.length === 0;

  return (
    <div className="space-y-5 pb-32">
      <header className="flex items-center justify-between gap-3">
        <Link to="/mesas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Mesas
        </Link>
        <span className="text-[10px] uppercase tracking-wider font-semibold rounded-full bg-muted px-2 py-1">
          {mesa.status}
        </span>
      </header>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <p className="text-xs text-muted-foreground">Mesa</p>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-4xl font-bold leading-none">{mesa.numero}</h1>
          {time && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {time}
            </span>
          )}
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Em aberto</p>
            <p className="font-display text-3xl font-bold tabular-nums">{formatBRL(totalAberto)}</p>
          </div>
          <Link
            to="/pedidos/novo"
            search={{ mesa: mesa.id } as any}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-card"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </Link>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-display font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Pedidos</h2>
        {semPedidos ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
            Nenhum pedido nesta mesa.
          </p>
        ) : (
          <ul className="space-y-2">
            {pedidos.map((p: any) => (
              <li key={p.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold">#{p.id.slice(0, 4).toUpperCase()}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-semibold rounded bg-muted px-1.5 py-0.5">
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                    <span className="font-bold tabular-nums">{formatBRL(Number(p.total_amount))}</span>
                  </div>
                </div>
                <ul className="mt-2 space-y-0.5">
                  {((p.items ?? []) as any[]).map((it, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {it.quantity}x {it.name}
                      {it.observacao ? <span className="text-xs"> — {it.observacao}</span> : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sticky actions */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:pl-60 z-30 border-t border-border bg-background/95 backdrop-blur p-3 flex gap-2">
        {mesa.status === "ocupada" && (
          <button
            onClick={() => fecharM.mutate()}
            disabled={fecharM.isPending || semPedidos}
            className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Fechar conta
          </button>
        )}
        {mesa.status === "conta" && (
          <button
            onClick={() => liberarM.mutate()}
            disabled={liberarM.isPending}
            className="rounded-lg border border-border px-3 py-2.5 text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Unlock className="h-4 w-4" /> Liberar
          </button>
        )}
        <button
          onClick={() => {
            if (confirm(`Marcar mesa ${mesa.numero} como paga e liberar?`)) pagarM.mutate();
          }}
          disabled={pagarM.isPending || semPedidos || totalAberto === 0}
          className="flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <DollarSign className="h-4 w-4" />
          {pagarM.isPending ? "Processando..." : `Pagar ${formatBRL(totalAberto)}`}
        </button>
      </div>
    </div>
  );
}
