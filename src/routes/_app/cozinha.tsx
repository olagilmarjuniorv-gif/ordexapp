import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  listPedidos,
  updatePedidoStatus,
  updatePedidoStatusFinanceiro,
  voltarParaCozinha,
  setFaseCanal,
  type PedidoStatus,
  type FaseCanal,
} from "@/lib/pedidos.functions";
import { useAuth } from "@/lib/auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { ChefHat, Play, Check, Volume2, VolumeX, Maximize2, Minimize2, Sun, Moon, AlertTriangle, Clock, Utensils, ExternalLink, Bike, PackageCheck, ShoppingBag, Undo2, CheckCircle2, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cozinha")({
  component: Cozinha,
  head: () => ({ meta: [{ title: "Cozinha — SaiuPedido" }] }),
});

type ColKey = "novo" | "preparo" | "pronto";

const COLUMNS: { key: ColKey; title: string; accent: string; head: string; headDark: string }[] = [
  { key: "novo", title: "Aguardando", accent: "amber", head: "bg-amber-400 text-amber-950", headDark: "bg-amber-400 text-amber-950" },
  { key: "preparo", title: "Em preparo", accent: "orange", head: "bg-orange-500 text-white", headDark: "bg-orange-500 text-white" },
  { key: "pronto", title: "Pronto", accent: "emerald", head: "bg-emerald-500 text-white", headDark: "bg-emerald-500 text-white" },
];

function slaTone(ageMin: number, dark: boolean) {
  // 0-15 normal | 15-25 amarelo | 25-35 laranja | >35 vermelho
  if (ageMin >= 35) return {
    ring: "ring-2 ring-rose-500",
    badge: "bg-rose-600 text-white",
    label: "ATRASADO",
    pulse: true,
  };
  if (ageMin >= 25) return {
    ring: "ring-2 ring-orange-500",
    badge: "bg-orange-500 text-white",
    label: "Atenção",
    pulse: false,
  };
  if (ageMin >= 15) return {
    ring: "ring-2 ring-amber-400",
    badge: "bg-amber-400 text-amber-950",
    label: "Acompanhar",
    pulse: false,
  };
  return {
    ring: "",
    badge: dark ? "bg-zinc-700 text-zinc-100" : "bg-zinc-200 text-zinc-700",
    label: "No prazo",
    pulse: false,
  };
}

function cardTone(col: ColKey, dark: boolean) {
  if (col === "novo") return dark ? "border-amber-500/60 bg-amber-500/5" : "border-amber-300 bg-amber-50";
  if (col === "preparo") return dark ? "border-orange-500/60 bg-orange-500/5" : "border-orange-300 bg-orange-50";
  return dark ? "border-emerald-500/60 bg-emerald-500/5" : "border-emerald-300 bg-emerald-50";
}

function canalLabel(p: any) {
  if (p.mesa?.numero) return `Mesa ${p.mesa.numero}`;
  if (p.canal === "balcao") return "Balcão";
  if (p.canal === "retirada") return "Retirada";
  if (p.canal === "delivery") return "Delivery";
  return "Salão";
}

function countItems(items: any[]) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
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
  // tick para recalcular tempo a cada 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    localStorage.setItem("ordex.cozinha.theme", theme);
  }, [theme]);

  const ativos = ((data ?? []) as any[]).filter((p) =>
    ["novo", "preparo", "pronto"].includes(p.status),
  );

  const byCol: Record<ColKey, any[]> = { novo: [], preparo: [], pronto: [] };
  for (const p of ativos) {
    if (p.status in byCol) byCol[p.status as ColKey].push(p);
  }
  // ordenar mais antigos primeiro (urgência)
  for (const k of Object.keys(byCol) as ColKey[]) {
    byCol[k].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  useEffect(() => {
    const ids = new Set([...byCol.novo, ...byCol.preparo].map((p) => p.id));
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
  }, [ativos.map((p) => p.id + p.status).join(",")]);

  const updateM = useMutation({
    mutationFn: (input: { id: string; status: PedidoStatus }) => updateFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["mesas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const dark = theme === "dark";
  const isFullscreen = tv;
  const containerClass = isFullscreen
    ? `fixed inset-0 z-50 overflow-hidden flex flex-col p-4 lg:p-6 ${dark ? "bg-zinc-950 text-white" : "bg-zinc-50 text-zinc-900"}`
    : `flex flex-col min-h-screen ${dark ? "bg-zinc-950 text-white -mx-4 lg:-mx-8 -my-5 lg:-my-8 px-4 lg:px-8 py-5 lg:py-8" : "-mx-4 lg:-mx-8 -my-5 lg:-my-8 px-4 lg:px-8 py-5 lg:py-8 bg-zinc-50"}`;
  const subText = dark ? "text-zinc-400" : "text-muted-foreground";
  const btnBorder = dark ? "border-white/20 text-white" : "border-border";

  return (
    <div className={containerClass}>
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </div>
          <div>
            <h1 className={`font-display ${tv ? "text-3xl" : "text-2xl lg:text-3xl"} font-bold`}>Cozinha</h1>
            <p className={`text-sm ${subText} inline-flex items-center gap-1.5`}>
              <span className="realtime-dot" />
              {byCol.novo.length + byCol.preparo.length} ativos · {byCol.pronto.length} prontos · tempo real
            </p>
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

      {/* Kanban */}
      <div className={`flex-1 min-h-0 ${isFullscreen ? "overflow-hidden" : ""}`}>
        {/* mobile: scroll horizontal | tablet: 2 col | desktop: 3 col */}
        <div className="h-full grid grid-flow-col auto-cols-[85%] gap-3 overflow-x-auto snap-x snap-mandatory pb-2
                        sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:overflow-visible sm:snap-none
                        lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = byCol[col.key];
            return (
              <div
                key={col.key}
                className={`snap-start flex flex-col min-h-0 rounded-xl border ${dark ? "border-white/10 bg-white/[0.02]" : "border-zinc-200 bg-white"}`}
              >
                <div className={`flex items-center justify-between rounded-t-xl px-3 py-2 ${col.head}`}>
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wide text-sm">
                    {col.title}
                  </div>
                  <span className="inline-flex items-center justify-center min-w-7 h-6 px-2 rounded-full bg-black/20 text-xs font-bold">
                    {list.length}
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
                  {list.length === 0 ? (
                    <div className={`rounded-lg border border-dashed p-6 text-center text-xs ${dark ? "border-white/10 text-zinc-500" : "border-zinc-200 text-zinc-400"}`}>
                      Sem pedidos
                    </div>
                  ) : (
                    list.map((p) => {
                      const ageMin = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60_000);
                      const sla = slaTone(ageMin, dark);
                      const qty = countItems(p.items ?? []);
                      const tone = cardTone(col.key, dark);

                      return (
                        <div
                          key={p.id}
                          className={`rounded-xl border-2 p-3 ${tone} ${sla.ring} ${dark ? "text-white" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-display font-extrabold leading-none ${tv ? "text-2xl" : "text-xl"}`}>
                                {canalLabel(p)}
                              </p>
                              <p className={`text-xs mt-1 truncate ${dark ? "text-zinc-300" : "text-zinc-700"}`}>
                                {p.cliente?.name ?? "—"}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`text-[10px] font-bold uppercase rounded px-2 py-0.5 ${sla.badge} ${sla.pulse ? "animate-pulse" : ""}`}>
                                {ageMin}min
                              </span>
                              {p.external_provider === "ifood" && (
                                <span className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-red-500 text-white">iFood</span>
                              )}
                            </div>
                          </div>

                          <div className={`mt-2 flex items-center gap-3 text-xs ${dark ? "text-zinc-400" : "text-zinc-600"}`}>
                            <span className="inline-flex items-center gap-1">
                              <Utensils className="h-3 w-3" />
                              {qty} {qty === 1 ? "item" : "itens"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              #{p.id.slice(0, 4).toUpperCase()}
                            </span>
                            {ageMin >= 35 && (
                              <span className="inline-flex items-center gap-1 text-rose-500 font-bold">
                                <AlertTriangle className="h-3 w-3" />
                                {sla.label}
                              </span>
                            )}
                          </div>

                          <ul className="mt-2 space-y-0.5">
                            {((p.items ?? []) as any[]).slice(0, tv ? 8 : 5).map((it, i) => (
                              <li key={i} className={`leading-snug ${tv ? "text-base" : "text-sm"} font-semibold`}>
                                {it.quantity}× {it.kind === "combo" && "🍔 "}{it.name}
                                {it.observacao ? (
                                  <span className={`block text-[11px] font-normal italic ${dark ? "text-zinc-400" : "text-zinc-500"}`}>
                                    {it.observacao}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                            {(p.items?.length ?? 0) > (tv ? 8 : 5) && (
                              <li className={`text-[11px] ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
                                +{(p.items?.length ?? 0) - (tv ? 8 : 5)} item(ns)…
                              </li>
                            )}
                          </ul>

                          {p.observacao && (
                            <p className={`mt-2 text-xs italic border-l-2 border-amber-400 pl-2 ${dark ? "text-zinc-300" : "text-zinc-600"}`}>
                              {p.observacao}
                            </p>
                          )}

                          {col.key === "novo" && (
                            <button
                              onClick={() => updateM.mutate({ id: p.id, status: "preparo" })}
                              disabled={updateM.isPending}
                              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                            >
                              <Play className="h-4 w-4" />
                              Iniciar preparo
                            </button>
                          )}
                          {col.key === "preparo" && (
                            <button
                              onClick={() => updateM.mutate({ id: p.id, status: "pronto" })}
                              disabled={updateM.isPending}
                              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Check className="h-4 w-4" />
                              Marcar pronto
                            </button>
                          )}
                          {col.key === "pronto" && (
                            <Link
                              to="/pedidos/$id"
                              params={{ id: p.id }}
                              className={`mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${dark ? "border-white/20 text-white hover:bg-white/5" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"}`}
                            >
                              <ExternalLink className="h-4 w-4" /> Ver detalhes
                            </Link>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
