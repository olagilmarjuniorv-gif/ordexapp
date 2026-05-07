import { createFileRoute, Link } from "@tanstack/react-router";
import { Filter, Plus } from "lucide-react";
import { useState } from "react";
import { customerById, formatBRL, quotes, type QuoteStatus } from "@/lib/mock-data";
import { QuoteBadge } from "@/components/StatusBadge";
import { WhatsappButton } from "@/components/WhatsappButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/orcamentos/")({
  component: Orcamentos,
  head: () => ({ meta: [{ title: "Orçamentos — ObraGestor" }] }),
});

const filters: { key: QuoteStatus | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "rascunho", label: "Rascunho" },
  { key: "enviado", label: "Enviado" },
  { key: "aprovado", label: "Aprovado" },
  { key: "recusado", label: "Recusado" },
];

function Orcamentos() {
  const [filter, setFilter] = useState<QuoteStatus | "todos">("todos");
  const list = filter === "todos" ? quotes : quotes.filter((q) => q.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Orçamentos</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" /> {list.length} resultados</p>
        </div>
        <Link
          to="/orcamentos/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo</span>
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {list.map((q) => {
          const c = customerById(q.customerId);
          const msg = `Olá ${c?.name}, segue seu orçamento ${q.number} no valor de ${formatBRL(q.total)}.`;
          return (
            <li key={q.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold">{q.number}</p>
                    <QuoteBadge status={q.status} />
                  </div>
                  <p className="text-sm mt-0.5 truncate">{c?.name}</p>
                  <p className="text-xs text-muted-foreground">{q.createdAt} · {q.items.length} itens</p>
                </div>
                <p className="font-display text-lg font-bold whitespace-nowrap">{formatBRL(q.total)}</p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted">
                  Ver detalhes
                </button>
                <WhatsappButton phone={c?.phone} message={msg} label="Enviar" />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
