import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Loader2, Send, ShieldCheck, Building2 } from "lucide-react";
import { getTicket, replyTicket, setTicketStatus, TICKET_STATUSES } from "@/lib/tickets.functions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/suporte/$id")({
  component: TicketDetail,
  head: () => ({ meta: [{ title: "Chamado — ORDEX" }] }),
});

const STATUS_META: Record<string, { label: string; cls: string }> = {
  aberto: { label: "Aberto", cls: "bg-sky-100 text-sky-700" },
  em_andamento: { label: "Em andamento", cls: "bg-amber-100 text-amber-700" },
  aguardando: { label: "Aguardando", cls: "bg-violet-100 text-violet-700" },
  resolvido: { label: "Resolvido", cls: "bg-emerald-100 text-emerald-700" },
  fechado: { label: "Fechado", cls: "bg-zinc-200 text-zinc-700" },
};

function TicketDetail() {
  const { id } = Route.useParams();
  const { isSuperAdmin, user } = useAuth();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getTicket);
  const replyFn = useServerFn(replyTicket);
  const statusFn = useServerFn(setTicketStatus);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchFn({ data: { id } }),
    refetchInterval: 8000,
  });

  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages?.length]);

  const replyM = useMutation({
    mutationFn: () => replyFn({ data: { ticket_id: id, body: body.trim() } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const statusM = useMutation({
    mutationFn: (s: string) => statusFn({ data: { ticket_id: id, status: s as any } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Erro ao carregar chamado.</div>;

  const { ticket, messages } = data as any;
  const backTo = isSuperAdmin ? "/chamados" : "/suporte";

  return (
    <div className="space-y-4 pb-32">
      <header className="flex items-center justify-between gap-3">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${STATUS_META[ticket.status]?.cls ?? "bg-muted"}`}>
          {STATUS_META[ticket.status]?.label ?? ticket.status}
        </span>
      </header>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Building2 className="h-3 w-3" /> {ticket.company_name ?? "—"}
        </p>
        <h1 className="font-display text-xl lg:text-2xl font-bold leading-tight mt-1">{ticket.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">{ticket.category}</span>
          <span className="rounded-full bg-muted px-2 py-0.5">prioridade: {ticket.priority}</span>
          <span>aberto em {new Date(ticket.created_at).toLocaleString("pt-BR")}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {TICKET_STATUSES.map((s) => (
            <button
              key={s}
              disabled={s === ticket.status || statusM.isPending}
              onClick={() => statusM.mutate(s)}
              className={`text-[11px] px-2 py-1 rounded-md border transition ${
                s === ticket.status ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"
              }`}
            >
              {STATUS_META[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        {messages.map((m: any) => {
          const mine = m.author_id === user?.id;
          const isStaff = m.author_role === "super_admin";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${mine ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                <p className={`text-[11px] font-semibold mb-1 inline-flex items-center gap-1 ${mine ? "opacity-80" : "text-muted-foreground"}`}>
                  {isStaff && <ShieldCheck className="h-3 w-3" />}
                  {m.author_name} · {new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </section>

      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:pl-60 z-30 border-t border-border bg-background/95 backdrop-blur p-3">
        <div className="mx-auto max-w-6xl flex gap-2 items-end">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escreva uma resposta…"
            rows={2}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
          />
          <button
            disabled={body.trim().length === 0 || replyM.isPending}
            onClick={() => replyM.mutate()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
