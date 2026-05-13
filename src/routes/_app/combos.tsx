import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listCombos, upsertCombo, deleteCombo } from "@/lib/combos.functions";
import { listProdutos } from "@/lib/produtos.functions";
import { Loader2, Plus, Pencil, Trash2, Package2, X } from "lucide-react";

export const Route = createFileRoute("/_app/combos")({
  component: CombosPage,
  head: () => ({ meta: [{ title: "Combos — ORDEX" }] }),
});

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function CombosPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCombos);
  const listP = useServerFn(listProdutos);
  const upsert = useServerFn(upsertCombo);
  const del = useServerFn(deleteCombo);

  const { data, isLoading } = useQuery({ queryKey: ["combos"], queryFn: () => list({}) });
  const { data: produtos = [] } = useQuery({ queryKey: ["produtos"], queryFn: () => listP({}) });
  const [editing, setEditing] = useState<any | "new" | null>(null);

  const saveM = useMutation({
    mutationFn: (d: any) => upsert({ data: d }),
    onSuccess: () => { toast.success("Combo salvo"); qc.invalidateQueries({ queryKey: ["combos"] }); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["combos"] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Combos</h1>
          <p className="text-sm text-muted-foreground">{(data ?? []).length} combos</p>
        </div>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Novo combo
        </button>
      </div>

      {isLoading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-muted-foreground" /> : (
        <ul className="space-y-2">
          {(data as any[] ?? []).map((c) => (
            <li key={c.id} className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary overflow-hidden">
                {c.image_url ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" /> : <Package2 className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="font-display font-semibold text-primary tabular-nums">{brl(Number(c.price))}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {c.itens.map((i: any) => `${i.quantity}× ${i.produto?.name ?? ""}`).join(" · ") || "Sem itens"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditing(c)} className="p-2 text-muted-foreground hover:bg-muted rounded-md"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => confirm(`Excluir combo "${c.name}"?`) && delM.mutate(c.id)} className="p-2 text-rose-500 rounded-md"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
          {!(data ?? []).length && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhum combo.</div>
          )}
        </ul>
      )}

      {editing && (
        <ComboDialog initial={editing === "new" ? null : editing} produtos={produtos as any[]} loading={saveM.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(d) => saveM.mutate({ id: editing === "new" ? undefined : editing.id, ...d })} />
      )}
    </div>
  );
}

function ComboDialog({ initial, produtos, onClose, onSubmit, loading }: any) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);
  const [itens, setItens] = useState<{ produto_id: string; quantity: number }[]>(
    initial?.itens?.map((i: any) => ({ produto_id: i.produto_id, quantity: i.quantity })) ?? []
  );
  const [picker, setPicker] = useState("");

  function add() {
    if (!picker) return;
    if (itens.find((i) => i.produto_id === picker)) return;
    setItens([...itens, { produto_id: picker, quantity: 1 }]);
    setPicker("");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-background rounded-t-2xl sm:rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{initial ? "Editar" : "Novo"} combo</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, description, price: Number(price), active, image_url: initial?.image_url ?? null, itens }); }} className="space-y-3">
          <label className="block"><span className="text-sm font-medium">Nome</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-sm font-medium">Descrição</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-sm font-medium">Preço (R$)</span>
            <input required type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo</label>

          <div>
            <p className="text-sm font-medium mb-2">Itens do combo</p>
            <div className="flex gap-2">
              <select value={picker} onChange={(e) => setPicker(e.target.value)} className="flex-1 rounded-lg border border-input bg-background px-2 py-2 text-sm">
                <option value="">— Selecionar produto —</option>
                {produtos.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button type="button" onClick={add} className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">Adicionar</button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {itens.map((i, idx) => {
                const p = produtos.find((pp: any) => pp.id === i.produto_id);
                return (
                  <li key={i.produto_id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
                    <span className="flex-1 truncate">{p?.name ?? "?"}</span>
                    <input type="number" min={1} value={i.quantity} onChange={(e) => { const q = Math.max(1, Number(e.target.value)); setItens(itens.map((x, ix) => ix === idx ? { ...x, quantity: q } : x)); }} className="w-14 rounded border border-input bg-background px-2 py-1 text-sm" />
                    <button type="button" onClick={() => setItens(itens.filter((_, ix) => ix !== idx))} className="text-rose-500"><X className="h-4 w-4" /></button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">Cancelar</button>
            <button disabled={loading} className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
