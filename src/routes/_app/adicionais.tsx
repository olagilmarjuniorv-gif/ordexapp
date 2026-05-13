import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listAdicionaisGrupos, upsertAdicionalGrupo, deleteAdicionalGrupo,
  upsertAdicionalOpcao, deleteAdicionalOpcao,
} from "@/lib/adicionais.functions";
import { Loader2, Plus, Pencil, Trash2, Layers, X } from "lucide-react";

export const Route = createFileRoute("/_app/adicionais")({
  component: AdicionaisPage,
  head: () => ({ meta: [{ title: "Adicionais — ORDEX" }] }),
});

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function AdicionaisPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAdicionaisGrupos);
  const upG = useServerFn(upsertAdicionalGrupo);
  const delG = useServerFn(deleteAdicionalGrupo);
  const upO = useServerFn(upsertAdicionalOpcao);
  const delO = useServerFn(deleteAdicionalOpcao);

  const { data, isLoading } = useQuery({ queryKey: ["adicionais"], queryFn: () => list({}) });
  const [editingGrupo, setEditingGrupo] = useState<any | "new" | null>(null);
  const [editingOpcao, setEditingOpcao] = useState<{ grupo_id: string; opcao?: any } | null>(null);

  const saveGrupoM = useMutation({
    mutationFn: (d: any) => upG({ data: d }),
    onSuccess: () => { toast.success("Grupo salvo"); qc.invalidateQueries({ queryKey: ["adicionais"] }); setEditingGrupo(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delGrupoM = useMutation({
    mutationFn: (id: string) => delG({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adicionais"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const saveOpM = useMutation({
    mutationFn: (d: any) => upO({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adicionais"] }); setEditingOpcao(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delOpM = useMutation({
    mutationFn: (id: string) => delO({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adicionais"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Adicionais</h1>
          <p className="text-sm text-muted-foreground">Grupos com opções (ex.: Tamanho, Molhos)</p>
        </div>
        <button onClick={() => setEditingGrupo("new")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Novo grupo
        </button>
      </div>

      {isLoading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-muted-foreground" /> : (
        <div className="space-y-3">
          {(data as any[] ?? []).map((g) => (
            <div key={g.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary"><Layers className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.required ? "Obrigatório · " : ""}min {g.min_select} / max {g.max_select}
                  </p>
                </div>
                <button onClick={() => setEditingGrupo(g)} className="p-2 text-muted-foreground hover:bg-muted rounded-md"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => confirm(`Excluir grupo "${g.name}"?`) && delGrupoM.mutate(g.id)} className="p-2 text-rose-500 rounded-md"><Trash2 className="h-4 w-4" /></button>
              </div>
              <ul className="mt-3 space-y-1.5">
                {g.opcoes.map((o: any) => (
                  <li key={o.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <span className="flex-1">{o.name}{!o.active && <span className="ml-2 text-xs text-rose-500">inativa</span>}</span>
                    <span className="font-semibold tabular-nums">{brl(Number(o.price))}</span>
                    <button onClick={() => setEditingOpcao({ grupo_id: g.id, opcao: o })} className="p-1 text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => delOpM.mutate(o.id)} className="p-1 text-rose-500"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
                <button onClick={() => setEditingOpcao({ grupo_id: g.id })} className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-xs text-muted-foreground hover:bg-muted">
                  <Plus className="h-3.5 w-3.5" /> Adicionar opção
                </button>
              </ul>
            </div>
          ))}
          {!(data ?? []).length && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhum grupo.</div>
          )}
        </div>
      )}

      {editingGrupo && (
        <GrupoDialog initial={editingGrupo === "new" ? null : editingGrupo} loading={saveGrupoM.isPending}
          onClose={() => setEditingGrupo(null)}
          onSubmit={(d: any) => saveGrupoM.mutate({ id: editingGrupo === "new" ? undefined : editingGrupo.id, ...d })} />
      )}
      {editingOpcao && (
        <OpcaoDialog grupo_id={editingOpcao.grupo_id} initial={editingOpcao.opcao} loading={saveOpM.isPending}
          onClose={() => setEditingOpcao(null)}
          onSubmit={(d: any) => saveOpM.mutate({ ...d, grupo_id: editingOpcao.grupo_id, id: editingOpcao.opcao?.id })} />
      )}
    </div>
  );
}

function GrupoDialog({ initial, onClose, onSubmit, loading }: any) {
  const [name, setName] = useState(initial?.name ?? "");
  const [required, setRequired] = useState(initial?.required ?? false);
  const [min_select, setMin] = useState(initial?.min_select ?? 0);
  const [max_select, setMax] = useState(initial?.max_select ?? 1);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-background rounded-t-2xl sm:rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{initial ? "Editar" : "Novo"} grupo</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, required, min_select, max_select }); }} className="space-y-3">
          <label className="block"><span className="text-sm font-medium">Nome</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="text-sm font-medium">Mínimo</span>
              <input type="number" min={0} value={min_select} onChange={(e) => setMin(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
            <label className="block"><span className="text-sm font-medium">Máximo</span>
              <input type="number" min={1} value={max_select} onChange={(e) => setMax(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Obrigatório</label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">Cancelar</button>
            <button disabled={loading} className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OpcaoDialog({ initial, onClose, onSubmit, loading }: any) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-background rounded-t-2xl sm:rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{initial ? "Editar" : "Nova"} opção</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, price: Number(price), active }); }} className="space-y-3">
          <label className="block"><span className="text-sm font-medium">Nome</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-sm font-medium">Preço extra (R$)</span>
            <input type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativa</label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">Cancelar</button>
            <button disabled={loading} className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
