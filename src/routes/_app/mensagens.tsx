import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMensagens } from "@/lib/whatsapp.functions";
import { useAuth } from "@/lib/auth";
import { MessageCircle, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_app/mensagens")({
  component: MensagensPage,
  head: () => ({ meta: [{ title: "Mensagens — ORDEX" }] }),
});

function MensagensPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const fetchFn = useServerFn(listMensagens);
  const { data, isLoading } = useQuery({
    queryKey: ["mensagens"],
    queryFn: () => fetchFn({ data: { limit: 100 } }),
    enabled: isSuperAdmin || isAdmin,
  });

  if (!isSuperAdmin && !isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Acesso restrito.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Mensagens</h1>
        <p className="text-sm text-muted-foreground">
          Histórico de mensagens WhatsApp. Envio real ativa quando as credenciais Meta forem configuradas.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : !data || data.length === 0 ? (
          <div className="p-10 text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((m: any) => (
              <li key={m.id} className="flex items-start gap-3 p-4">
                <div className={`mt-0.5 rounded-md p-1.5 ${m.direction === "in" ? "bg-primary-soft text-primary" : "bg-success/15 text-success"}`}>
                  {m.direction === "in" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">{m.status}</span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
