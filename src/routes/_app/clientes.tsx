import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Phone, Plus, Search } from "lucide-react";
import { customers } from "@/lib/mock-data";
import { WhatsappButton } from "@/components/WhatsappButton";

export const Route = createFileRoute("/_app/clientes")({
  component: Clientes,
  head: () => ({ meta: [{ title: "Clientes — ObraGestor" }] }),
});

function Clientes() {
  const [q, setQ] = useState("");
  const list = useMemo(
    () => customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.city.toLowerCase().includes(q.toLowerCase())),
    [q]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{customers.length} cadastrados</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo cliente</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou cidade"
          className="w-full rounded-lg border border-input bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary font-bold">
              {c.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> {c.phone} · {c.city}
              </p>
              {c.lastOrder && <p className="text-[11px] text-muted-foreground mt-0.5">Último pedido {c.lastOrder}</p>}
            </div>
            <WhatsappButton phone={c.phone} label="" message={`Olá ${c.name}, tudo bem?`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
