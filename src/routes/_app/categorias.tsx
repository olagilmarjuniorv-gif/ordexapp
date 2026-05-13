import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listCategorias, upsertCategoria, deleteCategoria } from "@/lib/categorias.functions";
import { Loader2, Plus, Pencil, Trash2, Tag } from "lucide-react";

export const Route = createFileRoute("/_app/categorias")({
  component: CategoriasPage,
  head: () => ({ meta: [{ title: "Categorias — ORDEX" }] }),
});

type Cat = { id: string; name: string; sort_order: number; active: boolean };

function CategoriasPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCategorias);
  const upsert = useServerFn(upsertCategoria);
  const del = useServerFn(deleteCategoria);
  const [editing, setEditing] = useState<Cat | "new" | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["categorias"], queryFn: () => list({}) });

  const saveM = useMutation({
    mutationFn: (d: any) => upsert({ data: d }),
    onSuccess: () => { toast.success("Categoria salva"); qc.invalidateQueries({ queryKey: ["categorias"] }); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["categorias"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Categorias</h1>
          <p className="text-sm text-muted-foreground">{(data ?? []).length} cadastradas</p>
        </div>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Nova
        </button>
      </div>

      {isLoading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-muted-foreground" /> : (
        <ul className="space-y-2">
          {(data as Cat[] ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary"><Tag className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">Ordem {c.sort_order}{!c.active && " · Inativa"}</p>
              </div>
              <button onClick={() => setEditing(c)} className="p-2 text-muted-foreground hover:bg-muted rounded-md"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => confirm(`Excluir "${c.name}"?`) && delM.mutate(c.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-md"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
          {!isLoading && !(data ?? []).length && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhuma categoria.</div>
          )}
        </ul>
      )}

      {editing && (
        <CategoriaDialog initial={editing === "new" ? null : editing} loading={saveM.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(d: any) => saveM.mutate({ id: editing === "new" ? undefined : editing.id, ...d })} />
      )}
    </div>
  );
}

function CategoriaDialog({ initial, onClose, onSubmit, loading }: any) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sort_order, setSort] = useState(initial?.sort_order ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-background rounded-t-2xl sm:rounded-2xl p-5 shadow-elevated">
        <h2 className="font-display text-lg font-semibold mb-4">{initial ? "Editar" : "Nova"} categoria</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, sort_order, active }); }} className="space-y-3">
          <label className="block"><span className="text-sm font-medium">Nome</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-sm font-medium">Ordem</span>
            <input type="number" value={sort_order} onChange={(e) => setSort(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativa</label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">Cancelar</button>
            <button disabled={loading} className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
