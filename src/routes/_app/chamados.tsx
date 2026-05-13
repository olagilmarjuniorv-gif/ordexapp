import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { listTickets } from "@/lib/tickets.functions";

export const Route = createFileRoute("/_app/chamados")({
  component: ChamadosPage,
  head: () => ({ meta: [{ title: "Chamados — ORDEX" }] }),
});

const STATUS_META: Record<string, { label: string; cls: string }> = {
  aberto: { label: "Aberto", cls: "bg-sky-100 text-sky-700" },
  em_andamento: { label: "Em andamento", cls: "bg-amber-100 text-amber-700" },
  aguardando: { label: "Aguardando empresa", cls: "bg-violet-100 text-violet-700" },
  resolvido: { label: "Resolvido", cls: "bg-emerald-100 text-emerald-700" },
  fechado: { label: "Fechado", cls: "bg-zinc-200 text-zinc-700" },
};
const PRIO_META: Record<string, string> = {
  baixa: "bg-zinc-100 text-zinc-600",
  normal: "bg-sky-100 text-sky-700",
  alta: "bg-amber-100 text-amber-700",
  urgente: "bg-rose-100 text-rose-700",
};

function elapsed(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function ChamadosPage() {
  const fetchFn = useServerFn(listTickets);
  const { data, isLoading } = useQuery({ queryKey: ["tickets"], queryFn: () => fetchFn({}), refetchInterval: 15000 });
  const [filter, setFilter] = useState<string>("ativos");

  const tickets = (data ?? []) as any[];
  const filtered = tickets.filter((t) => {
    if (filter === "todos") return true;
    if (filter === "ativos") return !["resolvido", "fechado"].includes(t.status);
    return t.status === filter;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold inline-flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Chamados
          </h1>
          <p className="text-sm text-muted-foreground">Inbox de suporte das empresas clientes</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {["ativos", "aberto", "em_andamento", "aguardando", "resolvido", "todos"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filter === f ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            {f === "ativos" ? "Ativos" : f === "todos" ? "Todos" : STATUS_META[f]?.label ?? f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <MessageSquare className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum chamado neste filtro.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id}>
              <Link to="/suporte/$id" params={{ id: t.id }} className="block rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-primary truncate">{t.company_name ?? "—"}</p>
                    <p className="font-medium truncate mt-0.5">{t.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_META[t.status]?.cls ?? "bg-muted"}`}>
                        {STATUS_META[t.status]?.label ?? t.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${PRIO_META[t.priority] ?? "bg-muted"}`}>
                        {t.priority}
                      </span>
                      <span>aberto por {t.created_by_name ?? "—"}</span>
                      <span className="tabular-nums">há {elapsed(t.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground tabular-nums shrink-0">
                    última msg<br />
                    <span className="text-foreground font-medium">{elapsed(t.last_message_at)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
