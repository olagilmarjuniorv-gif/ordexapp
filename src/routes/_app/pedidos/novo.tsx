import { createFileRoute, Link } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_app/pedidos/novo")({
  component: NovoPedido,
  head: () => ({ meta: [{ title: "Novo pedido — ORDEX" }] }),
});

function NovoPedido() {
  return (
    <div className="max-w-xl mx-auto text-center py-16 space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Construction className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl font-bold">Novo pedido</h1>
      <p className="text-sm text-muted-foreground">
        O fluxo rápido de pedidos (mesa → produtos → adicionais → enviar) chega na próxima fase.
      </p>
      <Link to="/pedidos" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
        Voltar para pedidos
      </Link>
    </div>
  );
}
