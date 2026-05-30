import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listPedidos,
  updatePedidoStatus,
  voltarParaCozinha,
  setFaseCanal,
  type FaseCanal,
} from "@/lib/pedidos.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { PackageCheck, Bike, ShoppingBag, Utensils, ClipboardList, Undo2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/expedicao")({
  component: Expedicao,
  head: () => ({ meta: [{ title: "Expedição — SaiuPedido" }] }),
});

const CANAL_LABEL: Record<string, string> = {
  salao: "Mesa",
  balcao: "Balcão",
  retirada: "Retirada",
  delivery: "Delivery",
};
const CANAL_ICON: Record<string, any> = {
  salao: Utensils,
  balcao: ShoppingBag,
  retirada: PackageCheck,
  delivery: Bike,
};
const FASE_LABEL: Partial<Record<FaseCanal, string>> = {
  aguardando_servir: "Aguardando servir",
  em_consumo: "Em consumo",
  aguardando_retirada: "Aguardando retirada",
  retirado: "Retirado",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  aguardando_cliente: "Aguardando cliente",
};

type CanalFiltro = "todos" | "salao" | "balcao" | "retirada" | "delivery";

function Expedicao() {
  const qc = useQueryClient();
  const [canal, setCanal] = useState<CanalFiltro>("todos");
  const fetchFn = useServerFn(listPedidos);
  const statusFn = useServerFn(updatePedidoStatus);
  const voltarFn = useServerFn(voltarParaCozinha);
  const faseFn = useServerFn(setFaseCanal);

  const { data, isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => fetchFn({}),
  });
  useRealtimeInvalidate("pedidos", [["pedidos"], ["mesas"]]);

  const ativos = ((data ?? []) as any[])
    .filter((p) => p.status === "pronto")
    .filter((p) => canal === "todos" || p.canal === canal)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const finalizar = useMutation({
    mutationFn: (id: string) => statusFn({ data: { id, status: "finalizado" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["mesas"] });
      toast.success("Pedido finalizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const voltar = useMutation({
    mutationFn: (id: string) => voltarFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Devolvido à cozinha");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const fase = useMutation({
    mutationFn: (v: { id: string; fase: FaseCanal | null; finalizar?: boolean }) =>
      faseFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["mesas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const FILTROS: { id: CanalFiltro; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "salao", label: "Mesa" },
    { id: "balcao", label: "Balcão" },
    { id: "retirada", label: "Retirada" },
    { id: "delivery", label: "Delivery" },
  ];

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Expedição</h1>
            <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
              <span className="realtime-dot" />
              {ativos.length} pedido{ativos.length === 1 ? "" : "s"} pronto{ativos.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const active = canal === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setCanal(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition border ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isLoading ? null : ativos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum pedido aguardando expedição.</p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {ativos.map((p) => {
            const Icon = CANAL_ICON[p.canal] ?? PackageCheck;
            const ageMin = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60_000);
            const titulo = p.mesa?.numero
              ? `Mesa ${p.mesa.numero}`
              : (p.cliente?.name ?? CANAL_LABEL[p.canal] ?? p.canal);
            const subt = p.cliente?.name && p.mesa?.numero ? p.cliente.name : (CANAL_LABEL[p.canal] ?? p.canal);
            const pago = p.status_financeiro === "pago";

            return (
              <div key={p.id} className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/40 p-4 order-enter">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      <Icon className="h-3 w-3" /> {CANAL_LABEL[p.canal] ?? p.canal}
                    </div>
                    <p className="font-display font-extrabold text-2xl leading-tight mt-0.5">{titulo}</p>
                    <p className="text-xs text-muted-foreground">#{p.id.slice(0, 4).toUpperCase()} · {subt}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground tabular-nums">{ageMin}min</p>
                    {pago ? (
                      <span className="inline-block mt-1 text-[10px] font-bold uppercase rounded bg-emerald-500 text-white px-1.5 py-0.5">Pago</span>
                    ) : (
                      <span className="inline-block mt-1 text-[10px] font-bold uppercase rounded bg-amber-500 text-white px-1.5 py-0.5">Pgto pendente</span>
                    )}
                  </div>
                </div>

                <ul className="mt-2.5 space-y-0.5 text-sm">
                  {((p.items ?? []) as any[]).slice(0, 4).map((it, i) => (
                    <li key={i} className="text-muted-foreground">
                      {it.quantity}× {it.name}
                    </li>
                  ))}
                  {(p.items ?? []).length > 4 && (
                    <li className="text-xs text-muted-foreground">+ {(p.items as any[]).length - 4} item(ns)</li>
                  )}
                </ul>

                {p.fase_canal && (
                  <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {FASE_LABEL[p.fase_canal as FaseCanal] ?? p.fase_canal}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {/* Ações por canal */}
                  {p.canal === "salao" && (
                    <>
                      {p.fase_canal !== "em_consumo" && (
                        <button
                          onClick={() => fase.mutate({ id: p.id, fase: "em_consumo" })}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-semibold"
                        >
                          Servido
                        </button>
                      )}
                      <button
                        onClick={() => fase.mutate({ id: p.id, fase: null, finalizar: true })}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-2 text-xs font-bold text-primary-foreground"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar
                      </button>
                    </>
                  )}
                  {p.canal === "balcao" && (
                    <button
                      onClick={() => fase.mutate({ id: p.id, fase: "entregue", finalizar: true })}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-2 text-xs font-bold text-primary-foreground"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Entregue ao cliente
                    </button>
                  )}
                  {p.canal === "retirada" && (
                    <button
                      onClick={() => fase.mutate({ id: p.id, fase: "retirado", finalizar: true })}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-2 text-xs font-bold text-primary-foreground"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Retirado
                    </button>
                  )}
                  {p.canal === "delivery" && (
                    <>
                      {p.fase_canal !== "saiu_entrega" ? (
                        <button
                          onClick={() => fase.mutate({ id: p.id, fase: "saiu_entrega" })}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-semibold"
                        >
                          <Bike className="h-3.5 w-3.5" /> Saiu p/ entrega
                        </button>
                      ) : (
                        <button
                          onClick={() => fase.mutate({ id: p.id, fase: "entregue", finalizar: true })}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-2 text-xs font-bold text-primary-foreground"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Entregue
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => voltar.mutate(p.id)}
                    title="Voltar para cozinha"
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-semibold"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
