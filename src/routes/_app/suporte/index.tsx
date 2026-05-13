import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LifeBuoy, Plus, Loader2, X, MessageSquare } from "lucide-react";
import { listTickets, createTicket, TICKET_PRIORITIES, TICKET_CATEGORIES } from "@/lib/tickets.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/suporte/")({
  component: SuportePage,
  head: () => ({ meta: [{ title: "Suporte — ORDEX" }] }),
});

const STATUS_META: Record<string, { label: string; cls: string }> = {
  aberto: { label: "Aberto", cls: "bg-sky-100 text-sky-700" },
  em_andamento: { label: "Em andamento", cls: "bg-amber-100 text-amber-700" },
  aguardando: { label: "Aguardando você", cls: "bg-violet-100 text-violet-700" },
  resolvido: { label: "Resolvido", cls: "bg-emerald-100 text-emerald-700" },
  fechado: { label: "Fechado", cls: "bg-zinc-200 text-zinc-700" },
};
const PRIO_META: Record<string, string> = {
  baixa: "bg-zinc-100 text-zinc-600",
  normal: "bg-sky-100 text-sky-700",
  alta: "bg-amber-100 text-amber-700",
  urgente: "bg-rose-100 text-rose-700",
};

function SuportePage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listTickets);
  const createFn = useServerFn(createTicket);

  const { data, isLoading } = useQuery({ queryKey: ["tickets"], queryFn: () => fetchFn({}) });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof TICKET_CATEGORIES)[number]>("duvida");
  const [priority, setPriority] = useState<(typeof TICKET_PRIORITIES)[number]>("normal");

  const createM = useMutation({
    mutationFn: () => createFn({ data: { title: title.trim(), description: description.trim(), category, priority } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setCategory("duvida");
      setPriority("normal");
      toast.success("Chamado aberto");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const tickets = data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold inline-flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" /> Suporte
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${tickets.length} chamado${tickets.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo chamado</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <MessageSquare className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Nenhum chamado aberto.</p>
          <button onClick={() => setOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card">
            <Plus className="h-4 w-4" /> Abrir chamado
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t: any) => (
            <li key={t.id}>
              <Link to="/suporte/$id" params={{ id: t.id }} className="block rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_META[t.status]?.cls ?? "bg-muted"}`}>
                        {STATUS_META[t.status]?.label ?? t.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${PRIO_META[t.priority] ?? "bg-muted"}`}>
                        {t.priority}
                      </span>
                      <span>{t.category}</span>
                      <span className="tabular-nums">{new Date(t.last_message_at).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-background border border-border shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display font-semibold">Novo chamado</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Título</label>
                <input
                  autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Resumo do problema"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                    {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                    {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                <textarea
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  rows={5} placeholder="Descreva o problema com detalhes…"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium">Cancelar</button>
              <button
                disabled={title.trim().length < 3 || description.trim().length < 5 || createM.isPending}
                onClick={() => createM.mutate()}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {createM.isPending ? "Enviando…" : "Abrir chamado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
