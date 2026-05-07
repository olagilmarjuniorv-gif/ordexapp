import { createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/_app/entregas")({
  component: Entregas,
  head: () => ({ meta: [{ title: "Entregas — ObraGestor" }] }),
});

function Entregas() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Entregas</h1>
        <p className="text-sm text-muted-foreground">Roteirize e acompanhe entregas.</p>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Truck className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-lg font-semibold">Em breve</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
          Painel de entregas com status e rota será adicionado em seguida.
        </p>
      </div>
    </div>
  );
}
