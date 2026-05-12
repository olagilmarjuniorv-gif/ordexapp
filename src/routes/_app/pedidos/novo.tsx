import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Search, Plus, Minus, Trash2, Loader2, ShoppingBag } from "lucide-react";
import { listProdutos } from "@/lib/produtos.functions";
import { listMesas } from "@/lib/mesas.functions";
import { listClientes } from "@/lib/clientes.functions";
import { createPedido, PEDIDO_CANAIS } from "@/lib/pedidos.functions";
import { toast } from "sonner";

const searchSchema = z.object({
  mesa: z.string().uuid().optional(),
  canal: z.enum(PEDIDO_CANAIS).optional(),
});

export const Route = createFileRoute("/_app/pedidos/novo")({
  component: NovoPedido,
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Novo pedido — ORDEX" }] }),
});

type Canal = typeof PEDIDO_CANAIS[number];
const CANAL_OPTIONS: { value: Canal; label: string }[] = [
  { value: "salao", label: "Salão" },
  { value: "balcao", label: "Balcão" },
  { value: "retirada", label: "Retirada" },
  { value: "delivery", label: "Delivery" },
  { value: "whatsapp", label: "WhatsApp" },
];

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

type Item = { product_id: string; name: string; price: number; quantity: number };

function NovoPedido() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const fetchProdutos = useServerFn(listProdutos);
  const fetchMesas = useServerFn(listMesas);
  const fetchClientes = useServerFn(listClientes);
  const createFn = useServerFn(createPedido);

  const [canal, setCanal] = useState<Canal>(search.canal ?? (search.mesa ? "salao" : "salao"));
  const [mesaId, setMesaId] = useState<string | null>(search.mesa ?? null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => fetchProdutos({}),
  });
  const { data: mesas = [] } = useQuery({
    queryKey: ["mesas"],
    queryFn: () => fetchMesas({}),
    enabled: canal === "salao",
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => fetchClientes({}),
    enabled: canal === "delivery" || canal === "whatsapp",
  });

  const filtered = useMemo(() => {
    const list = (produtos as any[]).filter((p) => p.active);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [produtos, query]);

  const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const totalQty = items.reduce((acc, i) => acc + i.quantity, 0);

  function add(p: any) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) => (i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product_id: p.id, name: p.name, price: Number(p.price), quantity: 1 }];
    });
  }
  function inc(id: string) {
    setItems((prev) => prev.map((i) => (i.product_id === id ? { ...i, quantity: i.quantity + 1 } : i)));
  }
  function dec(id: string) {
    setItems((prev) =>
      prev.flatMap((i) => {
        if (i.product_id !== id) return [i];
        if (i.quantity <= 1) return [];
        return [{ ...i, quantity: i.quantity - 1 }];
      })
    );
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.product_id !== id));
  }

  const submit = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          canal,
          mesa_id: canal === "salao" ? mesaId : null,
          client_id: clienteId,
          observacao: observacao.trim() || undefined,
          items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, price: i.price })),
        },
      }),
    onSuccess: ({ id }) => {
      toast.success("Pedido criado");
      navigate({ to: "/pedidos/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar pedido"),
  });

  const canSubmit = items.length > 0 && (canal !== "salao" || mesaId);

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link to="/pedidos" className="rounded-lg p-2 -ml-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-xl lg:text-2xl font-bold leading-tight">Novo pedido</h1>
          <p className="text-xs text-muted-foreground">Selecione canal, produtos e envie</p>
        </div>
      </div>

      {/* Canal */}
      <div className="mb-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Canal</p>
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {CANAL_OPTIONS.map((c) => (
            <button
              key={c.value}
              onClick={() => {
                setCanal(c.value);
                if (c.value !== "salao") setMesaId(null);
              }}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                canal === c.value
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "bg-muted text-foreground/70 hover:bg-muted/70"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mesa picker */}
      {canal === "salao" && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Mesa</p>
          {mesas.length === 0 ? (
            <Link to="/mesas" className="block rounded-lg border border-dashed border-border bg-card p-3 text-center text-sm text-muted-foreground">
              Nenhuma mesa cadastrada — adicionar
            </Link>
          ) : (
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              {(mesas as any[]).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMesaId(m.id)}
                  className={`shrink-0 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${
                    mesaId === m.id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  Mesa {m.numero}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cliente (delivery/whatsapp) */}
      {(canal === "delivery" || canal === "whatsapp") && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Cliente</p>
          <select
            value={clienteId ?? ""}
            onChange={(e) => setClienteId(e.target.value || null)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">— Sem cliente —</option>
            {(clientes as any[]).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `· ${c.phone}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Search produtos */}
      <div className="mb-3 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produto..."
          className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm"
        />
      </div>

      {/* Produtos grid */}
      {loadingProdutos ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filtered.map((p: any) => {
            const inCart = items.find((i) => i.product_id === p.id);
            return (
              <button
                key={p.id}
                onClick={() => add(p)}
                className={`relative text-left rounded-xl border-2 bg-card p-3 transition hover:border-primary/40 ${
                  inCart ? "border-primary" : "border-border"
                }`}
              >
                <p className="text-sm font-medium leading-tight line-clamp-2">{p.name}</p>
                <p className="mt-1 text-sm font-display font-semibold text-primary">{formatBRL(Number(p.price))}</p>
                {inCart && (
                  <span className="absolute top-2 right-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {inCart.quantity}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Carrinho + observação */}
      {items.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Itens ({totalQty})</p>
          <ul className="space-y-1.5">
            {items.map((i) => (
              <li key={i.product_id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{i.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatBRL(i.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => dec(i.product_id)} className="h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-muted">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{i.quantity}</span>
                  <button onClick={() => inc(i.product_id)} className="h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-muted">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(i.product_id)} className="ml-1 h-7 w-7 rounded-md text-rose-500 flex items-center justify-center hover:bg-rose-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observação geral (ex: sem cebola, troco para 50)"
            rows={2}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
          />
        </div>
      )}

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-60 z-30 border-t border-border bg-background/95 backdrop-blur p-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground">Total</p>
            <p className="font-display text-xl font-bold tabular-nums leading-none">{formatBRL(total)}</p>
          </div>
          <button
            disabled={!canSubmit || submit.isPending}
            onClick={() => submit.mutate()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-40"
          >
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
            Enviar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
