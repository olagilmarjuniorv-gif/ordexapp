import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { History, Loader2, Filter } from "lucide-react";
import { listAuditLogs } from "@/lib/audit.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/historico")({
  component: HistoricoPage,
  head: () => ({ meta: [{ title: "Histórico — ORDEX" }] }),
});

const ACTION_LABEL: Record<string, string> = {
  "login": "Login",
  "user.create": "Usuário criado",
  "pedido.create": "Pedido criado",
  "pedido.preparo": "Pedido em preparo",
  "pedido.pronto": "Pedido pronto",
  "pedido.pago": "Pedido pago",
  "pedido.cancelado": "Pedido cancelado",
  "mesa.create": "Mesa criada",
  "mesa.fechar_conta": "Conta fechada",
  "mesa.pagar": "Mesa paga",
  "mesa.liberar": "Mesa liberada",
};

function HistoricoPage() {
  const { isSuperAdmin } = useAuth();
  const fetchFn = useServerFn(listAuditLogs);
  const [companyId, setCompanyId] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", companyId],
    queryFn: () => fetchFn({ data: { company_id: companyId || null, limit: 100 } }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 text-primary" /> Histórico
          </h1>
          <p className="text-sm text-muted-foreground">Eventos importantes da operação</p>
        </div>
        {isSuperAdmin && (data?.companies?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Todas empresas</option>
              {data!.companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (data?.logs?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhum evento registrado.</p>
      ) : (
        <ul className="space-y-1.5">
          {data!.logs.map((l: any) => (
            <li key={l.id} className="rounded-lg border border-border bg-card p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-semibold rounded bg-primary/10 text-primary px-1.5 py-0.5">
                    {ACTION_LABEL[l.action] ?? l.action}
                  </span>
                  <span className="text-sm font-medium truncate">{l.description ?? "—"}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {l.user_name ?? "Sistema"} · {new Date(l.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
