import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { listPedidos, updatePedidoStatus, type PedidoStatus } from "@/lib/pedidos.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { useAuth } from "@/lib/auth";
import { ChefHat, Play, Check, DollarSign, Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cozinha")({
  component: Cozinha,
  head: () => ({ meta: [{ title: "Cozinha — ORDEX" }] }),
});

const LATE_MIN = 25;

const NEXT_LABEL: Partial<Record<PedidoStatus, { next: PedidoStatus; label: string; icon: any }>> = {
  novo: { next: "preparo", label: "Iniciar preparo", icon: Play },
  preparo: { next: "pronto", label: "Marcar pronto", icon: Check },
  pronto: { next: "pago", label: "Marcar pago", icon: DollarSign },
};

const STATUS_TONE: Record<string, { wrap: string; pill: string }> = {
  novo: { wrap: "border-amber-300 bg-amber-50", pill: "bg-amber-500 text-white" },
  preparo: { wrap: "border-blue-300 bg-blue-50", pill: "bg-blue-500 text-white" },
  pronto: { wrap: "border-emerald-400 bg-emerald-50", pill: "bg-emerald-600 text-white" },
};

function priority(p: any) {
  // pronto primeiro (pega/entrega rápido), depois atrasados, depois por idade.
  const ageMin = (Date.now() - new Date(p.created_at).getTime()) / 60_000;
  if (p.status === "pronto") return 0;
  if (ageMin >= LATE_MIN) return 1;
  if (p.status === "preparo") return 2;
  return 3;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {}
}

function Cozinha() {
  const { canSeeFinancials } = useAuth();
  const qc = useQueryClient();
  const fetchFn = useServerFn(listPedidos);
  const updateFn = useServerFn(updatePedidoStatus);
  const { data } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => fetchFn({}),
  });

  useRealtimeInvalidate("pedidos", [["pedidos"], ["mesas"]]);

  const [sound, setSound] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ordex.cozinha.sound") === "1";
  });
  const [tv, setTv] = useState(false);
  const [lastIds, setLastIds] = useState<Set<string>>(new Set());

  const ativos = ((data ?? []) as any[])
    .filter((p) => ["novo", "preparo", "pronto"].includes(p.status))
    .sort((a, b) => priority(a) - priority(b));

  // Som ao chegar pedido novo
  useEffect(() => {
    const ids = new Set(ativos.map((p) => p.id));
    if (lastIds.size > 0) {
      for (const id of ids) {
        if (!lastIds.has(id)) {
          if (sound) beep();
          break;
        }
      }
    }
    setLastIds(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativos.map((p) => p.id).join(",")]);

  const updateM = useMutation({
    mutationFn: (input: { id: string; status: PedidoStatus }) => updateFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["mesas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  return (
    <div className={tv ? "fixed inset-0 z-50 overflow-auto bg-zinc-950 text-white p-6" : "space-y-5"}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </div>
          <div>
            <h1 className={`font-display ${tv ? "text-3xl" : "text-2xl lg:text-3xl"} font-bold`}>Cozinha</h1>
            <p className={`text-sm ${tv ? "text-zinc-400" : "text-muted-foreground"}`}>
              {ativos.length} pedidos ativos · tempo real
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nv = !sound;
              setSound(nv);
              localStorage.setItem("ordex.cozinha.sound", nv ? "1" : "0");
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              tv ? "border-white/20 text-white" : "border-border"
            }`}
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline">Som</span>
          </button>
          <button
            onClick={() => setTv(!tv)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              tv ? "border-white/20 text-white" : "border-border"
            }`}
          >
            {tv ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{tv ? "Sair TV" : "Modo TV"}</span>
          </button>
        </div>
      </header>

      {ativos.length === 0 ? (
        <div className={`rounded-xl border border-dashed p-12 text-center ${tv ? "border-white/20 text-zinc-300" : "border-border bg-card text-muted-foreground"}`}>
          <p className="text-lg">Sem pedidos no momento.</p>
        </div>
      ) : (
        <div className={`grid gap-3 ${tv ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {ativos.map((p) => {
            const ageMin = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60_000);
            const late = ageMin >= LATE_MIN;
            const tone = STATUS_TONE[p.status] ?? STATUS_TONE.novo;
            const action = NEXT_LABEL[p.status as PedidoStatus];
            const allowPagoBtn = canSeeFinancials || p.status === "pronto";
            const showAction = action && (action.next !== "pago" || allowPagoBtn);

            return (
              <div
                key={p.id}
                className={`rounded-2xl border-2 p-4 transition ${tone.wrap} ${
                  late ? "ring-2 ring-rose-400 animate-pulse" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`font-display font-bold ${tv ? "text-3xl" : "text-2xl"}`}>
                    #{p.id.slice(0, 4).toUpperCase()}
                  </p>
                  <span className={`text-[10px] font-bold uppercase rounded px-2 py-0.5 ${tone.pill}`}>{p.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {p.cliente?.name ?? (p.mesa_id ? "Mesa" : p.canal)} · {ageMin}min
                  {late && <span className="ml-1 font-bold text-rose-600">ATRASADO</span>}
                </p>
                <ul className="mt-3 space-y-1">
                  {((p.items ?? []) as any[]).map((it, i) => (
                    <li key={i} className={`leading-tight ${tv ? "text-lg" : "text-base"} font-semibold`}>
                      {it.quantity}x {it.name}
                      {it.observacao ? (
                        <span className="block text-xs text-muted-foreground font-normal">{it.observacao}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {showAction && action && (
                  <button
                    onClick={() => updateM.mutate({ id: p.id, status: action.next })}
                    disabled={updateM.isPending}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-2.5 text-sm font-bold text-background hover:opacity-90 disabled:opacity-50"
                  >
                    <action.icon className="h-4 w-4" />
                    {action.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
