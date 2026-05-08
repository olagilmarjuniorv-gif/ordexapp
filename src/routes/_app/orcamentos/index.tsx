import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listOrcamentos } from "@/lib/orcamentos.functions";
import { Loader2, Plus, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/orcamentos/")({
  component: OrcamentosList,
  head: () => ({ meta: [{ title: "Orçamentos — ObraGestor" }] }),
});

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        draft: "bg-zinc-200 text-zinc-600",
        sent: "bg-sky-100 text-sky-600",
        approved: "bg-green-100 text-green-600",
        rejected: "bg-red-100 text-red-600",
        cancelled: "bg-neutral-100 text-neutral-500",
    }
    const labels: Record<string, string> = {
        draft: "Rascunho",
        sent: "Enviado",
        approved: "Aprovado",
        rejected: "Rejeitado",
        cancelled: "Cancelado",
    }
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status]}`}>{labels[status] ?? status}</span>
}

function OrcamentosList() {
  const fetchFn = useServerFn(listOrcamentos);
  const { data, isLoading } = useQuery({
    queryKey: ["orcamentos"],
    queryFn: () => fetchFn({}),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando..." : `${(data ?? []).length} registrados`}
          </p>
        </div>
        <Link to="/orcamentos/novo" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo orçamento</span>
        </Link>
      </div>

       {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((o: any) => (
            <li key={o.id}>
                 <Link to={`/orcamentos/${o.id}`} className="w-full text-left rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-sm transition-all block">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                                <p className="font-medium leading-tight truncate">{o.cliente.name}</p>
                                <p className="font-display font-semibold text-primary tabular-nums shrink-0">
                                {formatBRL(o.total_amount)}
                                </p>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <StatusBadge status={o.status} />
                                <span className="tabular-nums">
                                    Criado em {new Date(o.created_at).toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                        </div>
                    </div>
                </Link>
            </li>
          ))}
          {(data ?? []).length === 0 && (
             <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <FileText className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Nenhum orçamento encontrado.</p>
                 <Link to="/orcamentos/novo" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card">
                    <Plus className="h-4 w-4" /> Novo orçamento
                </Link>
            </div>
          )}
        </ul>
      )}
    </div>
  );
}
