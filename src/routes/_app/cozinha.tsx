import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPedidos } from "@/lib/pedidos.functions";
import { ChefHat } from "lucide-react";

export const Route = createFileRoute("/_app/cozinha")({
  component: Cozinha,
  head: () => ({ meta: [{ title: "Cozinha — ORDEX" }] }),
});

const LATE_MIN = 25;

function Cozinha() {
  const fetchFn = useServerFn(listPedidos);
  const { data } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => fetchFn({}),
    refetchInterval: 15_000,
  });

  const ativos = ((data ?? []) as any[]).filter((p) => ["novo", "preparo", "pronto"].includes(p.status));

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ChefHat className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Cozinha</h1>
          <p className="text-sm text-muted-foreground">{ativos.length} pedidos ativos · atualiza automaticamente</p>
        </div>
      </header>

      {ativos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-lg text-muted-foreground">Sem pedidos no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ativos.map((p) => {
            const ageMin = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60_000);
            const late = ageMin >= LATE_MIN;
            const tone = p.status === "pronto"
              ? "border-emerald-400 bg-emerald-50"
              : late
                ? "border-rose-400 bg-rose-50"
                : "border-amber-300 bg-amber-50";
            return (
              <div key={p.id} className={`rounded-2xl border-2 ${tone} p-4`}>
                <div className="flex items-baseline justify-between">
                  <p className="font-display text-2xl font-bold">#{p.id.slice(0, 4).toUpperCase()}</p>
                  <span className="text-sm font-bold uppercase">{p.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {p.cliente?.name ?? (p.mesa_id ? "Mesa" : "Balcão")} · {ageMin}min
                </p>
                <ul className="mt-3 space-y-1">
                  {((p.items ?? []) as any[]).map((it, i) => (
                    <li key={i} className="text-base font-semibold leading-tight">
                      {it.quantity}x {it.name}
                      {it.observacao ? <span className="block text-xs text-muted-foreground font-normal">{it.observacao}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
