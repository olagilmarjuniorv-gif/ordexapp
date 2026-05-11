import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/_app/mesas")({
  component: Mesas,
  head: () => ({ meta: [{ title: "Mesas — ORDEX" }] }),
});

function Mesas() {
  return (
    <div className="max-w-xl mx-auto text-center py-16 space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <LayoutGrid className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl font-bold">Mapa de mesas</h1>
      <p className="text-sm text-muted-foreground">
        Em breve você poderá abrir, fechar e visualizar mesas em tempo real aqui.
      </p>
    </div>
  );
}
