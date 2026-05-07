import { createFileRoute, Link } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_app/produtos")({
  component: Produtos,
  head: () => ({ meta: [{ title: "Produtos — ObraGestor" }] }),
});

function Produtos() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Produtos</h1>
        <p className="text-sm text-muted-foreground">Catálogo da sua loja.</p>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Construction className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-lg font-semibold">Em breve</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
          O cadastro de produtos chega na próxima versão. Por enquanto, adicione itens diretamente ao criar um orçamento.
        </p>
        <Link to="/orcamentos/novo" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Criar orçamento
        </Link>
      </div>
    </div>
  );
}
