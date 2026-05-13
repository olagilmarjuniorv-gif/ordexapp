import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { listPedidos, updatePedidoStatus, type PedidoStatus } from "@/lib/pedidos.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { useAuth } from "@/lib/auth";
import { ChefHat, Play, Check, DollarSign, Volume2, VolumeX, Maximize2, Minimize2, Sun, Moon, AlertTriangle } from "lucide-react";
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

// Tons fixos (sem piscar). Apenas borda/fundo por status.
const STATUS_TONE_LIGHT: Record<string, { wrap: string; pill: string }> = {
  novo: { wrap: "border-amber-300 bg-amber-50", pill: "bg-amber-500 text-white" },
  preparo: { wrap: "border-blue-300 bg-blue-50", pill: "bg-blue-500 text-white" },
  pronto: { wrap: "border-emerald-400 bg-emerald-50", pill: "bg-emerald-600 text-white" },
};
const STATUS_TONE_DARK: Record<string, { wrap: string; pill: string }> = {
  novo: { wrap: "border-amber-500/60 bg-amber-500/10", pill: "bg-amber-500 text-black" },
  preparo: { wrap: "border-blue-500/60 bg-blue-500/10", pill: "bg-blue-500 text-white" },
  pronto: { wrap: "border-emerald-500/70 bg-emerald-500/10", pill: "bg-emerald-500 text-black" },
};

function priority(p: any) {
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
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("ordex.cozinha.theme") as "light" | "dark") || "dark";
  });
  const [lastIds, setLastIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem("ordex.cozinha.theme", theme);
  }, [theme]);

  const ativos = ((data ?? []) as any[])
    .filter((p) => ["novo", "preparo", "pronto"].includes(p.status))
    .sort((a, b) => priority(a) - priority(b));

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

  const dark = theme === "dark";
  const tone = dark ? STATUS_TONE_DARK : STATUS_TONE_LIGHT;
  const isFullscreen = tv;
  const containerClass = isFullscreen
    ? `fixed inset-0 z-50 overflow-auto p-6 ${dark ? "bg-zinc-950 text-white" : "bg-white text-zinc-900"}`
    : `space-y-5 min-h-screen ${dark ? "bg-zinc-950 text-white -mx-4 lg:-mx-8 -my-5 lg:-my-8 px-4 lg:px-8 py-5 lg:py-8" : ""}`;
  const subText = dark ? "text-zinc-400" : "text-muted-foreground";
  const btnBorder = dark ? "border-white/20 text-white" : "border-border";

  return (
    <div className={containerClass}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </div>
          <div>
            <h1 className={`font-display ${tv ? "text-3xl" : "text-2xl lg:text-3xl"} font-bold`}>Cozinha</h1>
            <p className={`text-sm ${subText}`}>{ativos.length} pedidos ativos · tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(dark ? "light" : "dark")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${btnBorder}`}
            title="Alternar tema"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="hidden sm:inline">{dark ? "Claro" : "Escuro"}</span>
          </button>
          <button
            onClick={() => {
              const nv = !sound;
              setSound(nv);
              localStorage.setItem("ordex.cozinha.sound", nv ? "1" : "0");
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${btnBorder}`}
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline">Som</span>
          </button>
          <button
            onClick={() => setTv(!tv)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${btnBorder}`}
          >
            {tv ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{tv ? "Sair TV" : "Modo TV"}</span>
          </button>
        </div>
      </header>

      {ativos.length === 0 ? (
        <div className={`rounded-xl border border-dashed p-12 text-center ${dark ? "border-white/20 text-zinc-300" : "border-border bg-card text-muted-foreground"}`}>
          <p className="text-lg">Sem pedidos no momento.</p>
        </div>
      ) : (
        <div className={`grid gap-3 ${tv ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {ativos.map((p) => {
            const ageMin = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60_000);
            const late = ageMin >= LATE_MIN;
            const t = tone[p.status] ?? tone.novo;
            const action = NEXT_LABEL[p.status as PedidoStatus];
            const allowPagoBtn = canSeeFinancials || p.status === "pronto";
            const showAction = action && (action.next !== "pago" || allowPagoBtn);
            const cardText = dark ? "text-white" : "";

            return (
              <div
                key={p.id}
                className={`rounded-2xl border-2 p-4 transition ${t.wrap} ${cardText} ${late ? "ring-2 ring-rose-500/70" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`font-display font-extrabold leading-none ${tv ? "text-4xl" : "text-3xl"}`}>
                      {p.mesa?.numero ? `Mesa ${p.mesa.numero}` : (p.canal === "balcao" ? "Balcão" : p.canal === "retirada" ? "Retirada" : p.canal === "delivery" ? "Delivery" : "Salão")}
                    </p>
                    <p className={`text-[10px] uppercase tracking-wider mt-1 ${dark ? "text-zinc-400" : "text-muted-foreground"}`}>
                      #{p.id.slice(0, 4).toUpperCase()} · {p.cliente?.name ?? ""}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase rounded px-2 py-0.5 ${t.pill}`}>{p.status}</span>
                </div>
                <ul className="mt-3 space-y-1">
                  {((p.items ?? []) as any[]).map((it, i) => (
                    <li key={i} className={`leading-tight ${tv ? "text-xl" : "text-lg"} font-semibold`}>
                      {it.quantity}× {it.kind === "combo" && "🍔 "}{it.name}
                      {Array.isArray(it.adicionais) && it.adicionais.length > 0 && (
                        <ul className="mt-0.5 ml-4 space-y-0.5">
                          {it.adicionais.map((a: any, ai: number) => (
                            <li key={ai} className={`text-xs font-normal ${dark ? "text-zinc-400" : "text-muted-foreground"}`}>+ {a.name}</li>
                          ))}
                        </ul>
                      )}
                      {it.observacao ? (
                        <span className={`block text-xs font-normal italic ${dark ? "text-zinc-400" : "text-muted-foreground"}`}>{it.observacao}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {p.observacao && (
                  <p className={`mt-2 text-xs italic border-l-2 border-amber-400 pl-2 ${dark ? "text-zinc-300" : "text-muted-foreground"}`}>
                    {p.observacao}
                  </p>
                )}
                <div className={`mt-2 flex items-center justify-between text-xs ${late ? "text-rose-500 font-bold" : (dark ? "text-zinc-400" : "text-muted-foreground")}`}>
                  <span className="inline-flex items-center gap-1">
                    {late && <AlertTriangle className="h-3 w-3 animate-pulse" />}
                    <span className={late ? "animate-pulse" : ""}>{ageMin}min{late ? " · ATRASADO" : ""}</span>
                  </span>
                </div>
                {showAction && action && (
                  <button
                    onClick={() => updateM.mutate({ id: p.id, status: action.next })}
                    disabled={updateM.isPending}
                    className={`mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 ${dark ? "bg-white text-zinc-900" : "bg-foreground text-background"}`}
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
