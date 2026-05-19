import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LayoutGrid, Plus, Loader2, X, Trash2, Clock, Receipt, Pencil } from "lucide-react";
import { listMesas, createMesa, updateMesa, updateMesaStatus, deleteMesa, type MesaStatus } from "@/lib/mesas.functions";
import { useAuth } from "@/lib/auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/mesas/")({
  component: MesasPage,
  head: () => ({ meta: [{ title: "Mesas — ORDEX" }] }),
});

const STATUS_META: Record<MesaStatus, { label: string; ring: string; bg: string; text: string; dot: string }> = {
  livre: {
    label: "Livre",
    ring: "border-success/30",
    bg: "bg-success/5",
    text: "text-success",
    dot: "bg-success",
  },
  ocupada: {
    label: "Ocupada",
    ring: "border-warning/40",
    bg: "bg-warning/10",
    text: "text-warning-foreground",
    dot: "bg-warning",
  },
  conta: {
    label: "Conta",
    ring: "border-primary/30",
    bg: "bg-primary-soft",
    text: "text-primary",
    dot: "bg-primary",
  },
};

const NEXT_STATUS: Record<MesaStatus, MesaStatus> = {
  livre: "ocupada",
  ocupada: "conta",
  conta: "livre",
};

function elapsed(opened_at: string | null) {
  if (!opened_at) return null;
  const mins = Math.floor((Date.now() - new Date(opened_at).getTime()) / 60000);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  return `${h}h${(mins % 60).toString().padStart(2, "0")}`;
}

function MesasPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const fetchFn = useServerFn(listMesas);
  const createFn = useServerFn(createMesa);
  const updateFn = useServerFn(updateMesaStatus);
  const deleteFn = useServerFn(deleteMesa);
  const renameFn = useServerFn(updateMesa);

  const { data, isLoading } = useQuery({
    queryKey: ["mesas"],
    queryFn: () => fetchFn({}),
  });
  useRealtimeInvalidate("mesas", [["mesas"]]);
  useRealtimeInvalidate("pedidos", [["mesas"]]);

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<{ id: string; numero: string; capacidade: number } | null>(null);
  const [numero, setNumero] = useState("");
  const [capacidade, setCapacidade] = useState(4);

  const createM = useMutation({
    mutationFn: (input: { numero: string; capacidade: number }) => createFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mesas"] });
      setOpenModal(false);
      setNumero("");
      setCapacidade(4);
      toast.success("Mesa adicionada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar mesa"),
  });

  const updateM = useMutation({
    mutationFn: (input: { id: string; status: MesaStatus }) => updateFn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mesas"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mesas"] });
      toast.success("Mesa removida");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const renameM = useMutation({
    mutationFn: (input: { id: string; numero: string; capacidade: number }) => renameFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mesas"] });
      setEditing(null);
      toast.success("Mesa atualizada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const mesas = data ?? [];
  const counts = {
    livre: mesas.filter((m: any) => m.status === "livre").length,
    ocupada: mesas.filter((m: any) => m.status === "ocupada").length,
    conta: mesas.filter((m: any) => m.status === "conta").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Mesas</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando..." : `${mesas.length} mesa${mesas.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={() => setOpenModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-cta px-3 py-2 text-sm font-semibold text-cta-foreground shadow hover:brightness-110 hover:shadow-glow-cta transition-all"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova mesa</span>
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {(Object.keys(STATUS_META) as MesaStatus[]).map((s) => (
          <div key={s} className={`rounded-xl border ${STATUS_META[s].ring} ${STATUS_META[s].bg} p-3`}>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />
              <p className={`text-xs font-medium ${STATUS_META[s].text}`}>{STATUS_META[s].label}</p>
            </div>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{counts[s]}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : mesas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <LayoutGrid className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma mesa cadastrada.</p>
          <button
            onClick={() => setOpenModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card"
          >
            <Plus className="h-4 w-4" /> Adicionar mesa
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {mesas.map((m: any) => {
            const meta = STATUS_META[m.status as MesaStatus] ?? STATUS_META.livre;
            const time = elapsed(m.opened_at);
            return (
              <div
                key={m.id}
                className={`group relative rounded-2xl border-2 ${meta.ring} ${meta.bg} p-4 transition hover:shadow-md`}
              >
                {isAdmin && (
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <button
                      onClick={() => setEditing({ id: m.id, numero: m.numero, capacidade: m.capacidade ?? 4 })}
                      className="rounded-md bg-background/80 backdrop-blur p-1.5 text-foreground/70 hover:text-foreground hover:bg-background shadow-sm border border-border/50"
                      aria-label="Renomear mesa"
                      title="Renomear mesa"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir ${m.numero}?`)) deleteM.mutate(m.id);
                      }}
                      className="rounded-md bg-background/80 backdrop-blur p-1.5 text-foreground/70 hover:text-destructive hover:bg-background shadow-sm border border-border/50"
                      aria-label="Excluir mesa"
                      title="Excluir mesa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Mesa</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
                </div>
                <p className="font-display text-3xl font-bold leading-tight mt-1">{m.numero}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{m.capacidade} lugares</p>
                {time && (
                  <p className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium ${meta.text}`}>
                    <Clock className="h-3 w-3" /> {time}
                  </p>
                )}
                <div className="mt-3 flex flex-col gap-1.5">
                  {m.status === "livre" ? (
                    <Link
                      to="/pedidos/novo"
                      search={{ mesa: m.id } as any}
                      className="rounded-lg bg-primary px-2 py-1.5 text-center text-[11px] font-semibold text-primary-foreground"
                    >
                      Abrir mesa
                    </Link>
                  ) : (
                    <Link
                      to="/mesas/$id"
                      params={{ id: m.id }}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground"
                    >
                      <Receipt className="h-3 w-3" /> Ver comanda
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-background border border-border shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display font-semibold">Nova mesa</h2>
              <button onClick={() => setOpenModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Número / nome</label>
                <input
                  autoFocus
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="ex: 12 ou Varanda 3"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Capacidade</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={capacidade}
                  onChange={(e) => setCapacidade(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums"
                />
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <button onClick={() => setOpenModal(false)} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium">
                Cancelar
              </button>
              <button
                disabled={!numero.trim() || createM.isPending}
                onClick={() => createM.mutate({ numero: numero.trim(), capacidade })}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {createM.isPending ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-background border border-border shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display font-semibold">Editar mesa</h2>
              <button onClick={() => setEditing(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome / identificação</label>
                <input
                  autoFocus
                  value={editing.numero}
                  onChange={(e) => setEditing({ ...editing, numero: e.target.value })}
                  placeholder="ex: Mesa 12, Balcão, Deck 2"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Capacidade</label>
                <input
                  type="number" min={1} max={50}
                  value={editing.capacidade}
                  onChange={(e) => setEditing({ ...editing, capacidade: Math.max(1, Number(e.target.value) || 1) })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums"
                />
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium">Cancelar</button>
              <button
                disabled={!editing.numero.trim() || renameM.isPending}
                onClick={() => renameM.mutate({ id: editing.id, numero: editing.numero.trim(), capacidade: editing.capacidade })}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {renameM.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
