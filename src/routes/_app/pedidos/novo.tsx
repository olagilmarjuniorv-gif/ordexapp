import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Search, Plus, Minus, Trash2, Loader2, ShoppingBag, Package2 } from "lucide-react";
import { listProdutos } from "@/lib/produtos.functions";
import { listMesas } from "@/lib/mesas.functions";
import { listClientes } from "@/lib/clientes.functions";
import { listCategorias } from "@/lib/categorias.functions";
import { listCombos } from "@/lib/combos.functions";
import { getProdutoAdicionais } from "@/lib/adicionais.functions";
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
];

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type CartItem = {
  uid: string;
  kind: "produto" | "combo";
  product_id?: string;
  combo_id?: string;
  name: string;
  basePrice: number;
  quantity: number;
  adicionais: { name: string; price: number }[];
  observacao?: string;
};

function NovoPedido() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const fetchProdutos = useServerFn(listProdutos);
  const fetchMesas = useServerFn(listMesas);
  const fetchClientes = useServerFn(listClientes);
  const fetchCats = useServerFn(listCategorias);
  const fetchCombos = useServerFn(listCombos);
  const fetchProdAdic = useServerFn(getProdutoAdicionais);
  const createFn = useServerFn(createPedido);

  const [canal, setCanal] = useState<Canal>(search.canal ?? "salao");
  const [mesaId, setMesaId] = useState<string | null>(search.mesa ?? null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [items, setItems] = useState<CartItem[]>([]);
  const [picker, setPicker] = useState<{ produto: any; grupos: any[] } | null>(null);

  const { data: produtos = [], isLoading: loadingProdutos } = useQuery({ queryKey: ["produtos"], queryFn: () => fetchProdutos({}) });
  const { data: combos = [] } = useQuery({ queryKey: ["combos"], queryFn: () => fetchCombos({}) });
  const { data: categorias = [] } = useQuery({ queryKey: ["categorias"], queryFn: () => fetchCats({}) });
  const { data: mesas = [] } = useQuery({ queryKey: ["mesas"], queryFn: () => fetchMesas({}), enabled: canal === "salao" });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => fetchClientes({}), enabled: canal === "delivery" });

  const filteredProdutos = useMemo(() => {
    return (produtos as any[]).filter((p) => {
      if (!p.active || !p.available) return false;
      if (catFilter !== "all" && p.category_id !== catFilter) return false;
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [produtos, query, catFilter]);

  const filteredCombos = useMemo(() => {
    if (catFilter !== "all") return [];
    return (combos as any[]).filter((c) => c.active && (!query || c.name.toLowerCase().includes(query.toLowerCase())));
  }, [combos, query, catFilter]);

  const total = items.reduce((acc, i) => acc + (i.basePrice + i.adicionais.reduce((a, x) => a + x.price, 0)) * i.quantity, 0);
  const totalQty = items.reduce((acc, i) => acc + i.quantity, 0);

  async function tapProduto(p: any) {
    // verifica se tem grupos
    try {
      const grupos = await fetchProdAdic({ data: { produto_id: p.id } });
      if ((grupos as any[]).length > 0) {
        setPicker({ produto: p, grupos: grupos as any[] });
        return;
      }
    } catch {}
    addProduto(p, []);
  }

  function addProduto(p: any, adic: { name: string; price: number }[]) {
    setItems((prev) => [...prev, {
      uid: `${p.id}-${Date.now()}-${Math.random()}`, kind: "produto", product_id: p.id,
      name: p.name, basePrice: Number(p.price), quantity: 1, adicionais: adic,
    }]);
  }
  function addCombo(c: any) {
    setItems((prev) => [...prev, {
      uid: `${c.id}-${Date.now()}-${Math.random()}`, kind: "combo", combo_id: c.id,
      name: c.name, basePrice: Number(c.price), quantity: 1, adicionais: [],
    }]);
  }
  function inc(uid: string) { setItems((p) => p.map((i) => i.uid === uid ? { ...i, quantity: i.quantity + 1 } : i)); }
  function dec(uid: string) {
    setItems((p) => p.flatMap((i) => i.uid !== uid ? [i] : i.quantity <= 1 ? [] : [{ ...i, quantity: i.quantity - 1 }]));
  }
  function remove(uid: string) { setItems((p) => p.filter((i) => i.uid !== uid)); }

  const submit = useMutation({
    mutationFn: () => createFn({
      data: {
        canal,
        mesa_id: canal === "salao" ? mesaId : null,
        client_id: clienteId,
        observacao: observacao.trim() || undefined,
        items: items.map((i) => ({
          kind: i.kind,
          product_id: i.product_id,
          combo_id: i.combo_id,
          quantity: i.quantity,
          price: i.basePrice,
          adicionais: i.adicionais,
        })),
      },
    }),
    onSuccess: ({ id }) => { toast.success("Pedido criado"); navigate({ to: "/pedidos/$id", params: { id } }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar pedido"),
  });

  const canSubmit = items.length > 0 && (canal !== "salao" || mesaId);

  return (
    <div className="pb-32">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/pedidos" className="rounded-lg p-2 -ml-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="font-display text-xl lg:text-2xl font-bold leading-tight">Novo pedido</h1>
          <p className="text-xs text-muted-foreground">Selecione canal, produtos e envie</p>
        </div>
      </div>

      {/* Canal */}
      <div className="mb-3 flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {CANAL_OPTIONS.map((c) => (
          <button key={c.value} onClick={() => { setCanal(c.value); if (c.value !== "salao") setMesaId(null); }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${canal === c.value ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {canal === "salao" && (
        <div className="mb-3">
          {mesas.length === 0 ? (
            <Link to="/mesas" className="block rounded-lg border border-dashed border-border bg-card p-3 text-center text-sm text-muted-foreground">Nenhuma mesa — adicionar</Link>
          ) : (
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              {(mesas as any[]).map((m) => (
                <button key={m.id} onClick={() => setMesaId(m.id)}
                  className={`shrink-0 rounded-xl border-2 px-3 py-2 text-sm font-semibold ${mesaId === m.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}>
                  Mesa {m.numero}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {canal === "delivery" && (
        <div className="mb-3">
          <select value={clienteId ?? ""} onChange={(e) => setClienteId(e.target.value || null)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">— Sem cliente —</option>
            {(clientes as any[]).map((c) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `· ${c.phone}` : ""}</option>)}
          </select>
        </div>
      )}

      {/* Categorias */}
      {(categorias as any[]).length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          <button onClick={() => setCatFilter("all")} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${catFilter === "all" ? "bg-foreground text-background" : "bg-muted text-foreground/70"}`}>Todos</button>
          {(categorias as any[]).map((c) => (
            <button key={c.id} onClick={() => setCatFilter(c.id)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${catFilter === c.id ? "bg-foreground text-background" : "bg-muted text-foreground/70"}`}>{c.name}</button>
          ))}
        </div>
      )}

      <div className="mb-3 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm" />
      </div>

      {loadingProdutos ? <Loader2 className="mx-auto my-10 h-5 w-5 animate-spin text-muted-foreground" /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredCombos.map((c: any) => (
            <button key={`combo-${c.id}`} onClick={() => addCombo(c)}
              className="relative text-left rounded-xl border-2 border-amber-300 bg-amber-50 p-3 hover:border-amber-400">
              <div className="flex items-center gap-1 mb-1">
                <Package2 className="h-3 w-3 text-amber-700" />
                <span className="text-[10px] font-bold uppercase text-amber-700">Combo</span>
              </div>
              <p className="text-sm font-medium leading-tight line-clamp-2">{c.name}</p>
              <p className="mt-1 text-sm font-display font-semibold text-primary">{brl(Number(c.price))}</p>
            </button>
          ))}
          {filteredProdutos.map((p: any) => (
            <button key={p.id} onClick={() => tapProduto(p)}
              className="relative text-left rounded-xl border-2 border-border bg-card p-3 hover:border-primary/40 overflow-hidden">
              {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-20 object-cover rounded-lg mb-2" />}
              <p className="text-sm font-medium leading-tight line-clamp-2">{p.name}</p>
              <p className="mt-1 text-sm font-display font-semibold text-primary">{brl(Number(p.price))}</p>
            </button>
          ))}
          {filteredCombos.length + filteredProdutos.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Nada encontrado.</div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Itens ({totalQty})</p>
          <ul className="space-y-1.5">
            {items.map((i) => {
              const linePrice = i.basePrice + i.adicionais.reduce((a, x) => a + x.price, 0);
              return (
                <li key={i.uid} className="rounded-lg border border-border bg-card p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{i.kind === "combo" && "🍔 "}{i.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{brl(linePrice)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => dec(i.uid)} className="h-7 w-7 rounded-md border border-border flex items-center justify-center"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">{i.quantity}</span>
                      <button onClick={() => inc(i.uid)} className="h-7 w-7 rounded-md border border-border flex items-center justify-center"><Plus className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(i.uid)} className="ml-1 h-7 w-7 rounded-md text-rose-500 flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  {i.adicionais.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">+ {i.adicionais.map((a) => a.name).join(", ")}</p>
                  )}
                </li>
              );
            })}
          </ul>

          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observação geral" rows={2}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 lg:left-60 z-30 border-t border-border bg-background/95 backdrop-blur p-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">Total</p>
            <p className="font-display text-xl font-bold tabular-nums leading-none">{brl(total)}</p>
          </div>
          <button disabled={!canSubmit || submit.isPending} onClick={() => submit.mutate()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />} Enviar
          </button>
        </div>
      </div>

      {picker && (
        <AdicionaisPicker produto={picker.produto} grupos={picker.grupos}
          onClose={() => setPicker(null)}
          onConfirm={(adic: any) => { addProduto(picker.produto, adic); setPicker(null); }} />
      )}
    </div>
  );
}

function AdicionaisPicker({ produto, grupos, onClose, onConfirm }: any) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  function toggle(grupo: any, opcaoId: string) {
    const current = selected[grupo.id] ?? [];
    if (current.includes(opcaoId)) {
      setSelected({ ...selected, [grupo.id]: current.filter((x) => x !== opcaoId) });
      return;
    }
    if (grupo.max_select === 1) {
      setSelected({ ...selected, [grupo.id]: [opcaoId] });
    } else if (current.length < grupo.max_select) {
      setSelected({ ...selected, [grupo.id]: [...current, opcaoId] });
    }
  }
  function confirm() {
    for (const g of grupos) {
      const sel = selected[g.id] ?? [];
      if (sel.length < g.min_select) { toast.error(`Selecione ao menos ${g.min_select} em "${g.name}"`); return; }
      if (g.required && sel.length === 0) { toast.error(`"${g.name}" é obrigatório`); return; }
    }
    const adic: { name: string; price: number }[] = [];
    for (const g of grupos) {
      for (const oid of selected[g.id] ?? []) {
        const op = g.opcoes.find((o: any) => o.id === oid);
        if (op) adic.push({ name: `${g.name}: ${op.name}`, price: Number(op.price) });
      }
    }
    onConfirm(adic);
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-background rounded-t-2xl sm:rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold mb-1">{produto.name}</h2>
        <p className="text-xs text-muted-foreground mb-4">Personalize seu pedido</p>
        <div className="space-y-4">
          {grupos.map((g: any) => (
            <div key={g.id}>
              <p className="text-sm font-medium mb-2">
                {g.name} {g.required && <span className="text-rose-500">*</span>}
                <span className="text-xs text-muted-foreground ml-2">{g.max_select > 1 ? `até ${g.max_select}` : ""}</span>
              </p>
              <div className="space-y-1.5">
                {g.opcoes.map((o: any) => {
                  const isSel = (selected[g.id] ?? []).includes(o.id);
                  return (
                    <button key={o.id} type="button" onClick={() => toggle(g, o.id)}
                      className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${isSel ? "border-primary bg-primary-soft" : "border-border bg-card"}`}>
                      <span>{o.name}</span>
                      <span className="text-xs font-semibold tabular-nums">{Number(o.price) > 0 ? `+ ${brl(Number(o.price))}` : "—"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">Cancelar</button>
          <button onClick={confirm} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Adicionar</button>
        </div>
      </div>
    </div>
  );
}
