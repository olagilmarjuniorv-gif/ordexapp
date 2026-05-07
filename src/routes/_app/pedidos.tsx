import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { customerById, formatBRL, orders, type OrderStatus } from "@/lib/mock-data";
import { OrderBadge } from "@/components/StatusBadge";
import { WhatsappButton } from "@/components/WhatsappButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/pedidos")({
  component: Pedidos,
  head: () => ({ meta: [{ title: "Pedidos — ObraGestor" }] }),
});

const filters: { key: OrderStatus | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "novo", label: "Novos" },
  { key: "separando", label: "Separando" },
  { key: "pronto", label: "Prontos" },
  { key: "entregue", label: "Entregues" },
];

function Pedidos() {
  const [filter, setFilter] = useState<OrderStatus | "todos">("todos");
  const list = filter === "todos" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Acompanhe a separação e entrega.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium",
              filter === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {list.map((o) => {
          const c = customerById(o.customerId);
          return (
            <li key={o.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold">{o.number}</p>
                    <OrderBadge status={o.status} />
                  </div>
                  <p className="text-sm mt-0.5 truncate">{c?.name}</p>
                  <p className="text-xs text-muted-foreground">{o.createdAt}</p>
                </div>
                <p className="font-display text-lg font-bold">{formatBRL(o.total)}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium">
                  Avançar status
                </button>
                <WhatsappButton phone={c?.phone} label="Avisar" message={`Olá ${c?.name}, atualização do pedido ${o.number}.`} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
