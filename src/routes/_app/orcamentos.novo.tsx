import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { customers, formatBRL } from "@/lib/mock-data";
import { WhatsappButton } from "@/components/WhatsappButton";

export const Route = createFileRoute("/_app/orcamentos/novo")({
  component: NovoOrcamento,
  head: () => ({ meta: [{ title: "Novo orçamento — ObraGestor" }] }),
});

interface Item { id: number; description: string; qty: number; price: number }

function NovoOrcamento() {
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState(customers[0].id);
  const [items, setItems] = useState<Item[]>([
    { id: 1, description: "Cimento CP II 50kg", qty: 10, price: 38.9 },
  ]);

  const total = useMemo(() => items.reduce((s, i) => s + i.qty * i.price, 0), [items]);
  const customer = customers.find((c) => c.id === customerId);

  const addItem = () => setItems((it) => [...it, { id: Date.now(), description: "", qty: 1, price: 0 }]);
  const update = (id: number, patch: Partial<Item>) =>
    setItems((it) => it.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id: number) => setItems((it) => it.filter((i) => i.id !== id));

  const message = `Olá ${customer?.name}, segue seu orçamento:\n\n${items
    .map((i) => `• ${i.qty}x ${i.description} — ${formatBRL(i.qty * i.price)}`)
    .join("\n")}\n\nTotal: ${formatBRL(total)}`;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate({ to: "/orcamentos" })} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Novo orçamento</h1>
        <p className="text-sm text-muted-foreground">Monte rápido e envie pelo WhatsApp.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card space-y-3">
        <label className="text-sm font-medium">Cliente</label>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · {c.city}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display font-semibold">Itens</h2>
          <button onClick={addItem} className="inline-flex items-center gap-1 text-sm text-primary font-medium">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
        <ul className="divide-y divide-border">
          {items.map((i) => (
            <li key={i.id} className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={i.description}
                  onChange={(e) => update(i.id, { description: e.target.value })}
                  placeholder="Produto"
                  className="flex-1 rounded-md border border-input bg-background px-2.5 py-2 text-sm"
                />
                <button onClick={() => remove(i.id)} className="p-2 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Qtd</label>
                  <input
                    type="number"
                    value={i.qty}
                    onChange={(e) => update(i.id, { qty: Number(e.target.value) })}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Preço un.</label>
                  <input
                    type="number"
                    step="0.01"
                    value={i.price}
                    onChange={(e) => update(i.id, { price: Number(e.target.value) })}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Total</label>
                  <p className="px-2 py-1.5 text-sm font-semibold">{formatBRL(i.qty * i.price)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30 rounded-b-xl">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-display text-2xl font-bold text-primary">{formatBRL(total)}</span>
        </div>
      </div>

      <div className="sticky bottom-20 lg:bottom-4 z-10 flex gap-2 rounded-xl border border-border bg-card p-2 shadow-elevated">
        <Link to="/orcamentos" className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-center">
          Salvar rascunho
        </Link>
        <WhatsappButton phone={customer?.phone} message={message} label="Enviar no WhatsApp" className="flex-1" />
      </div>
    </div>
  );
}
