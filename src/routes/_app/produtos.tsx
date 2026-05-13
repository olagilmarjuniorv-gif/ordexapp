import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listProdutos, createProduto, updateProduto,
  setProdutoActive, setProdutoAvailable, uploadProdutoImage,
} from "@/lib/produtos.functions";
import { listCategorias } from "@/lib/categorias.functions";
import {
  listAdicionaisGrupos, getProdutoAdicionais, setProdutoAdicionais,
} from "@/lib/adicionais.functions";
import {
  Loader2, Package, Plus, Search, Pencil, Power, Image as ImageIcon, EyeOff, Eye,
} from "lucide-react";

export const Route = createFileRoute("/_app/produtos")({
  component: Produtos,
  head: () => ({ meta: [{ title: "Produtos — ORDEX" }] }),
});

type Produto = {
  id: string; name: string; description: string | null; price: number;
  active: boolean; available: boolean; image_url: string | null;
  category_id: string | null; stock: number;
};

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function Produtos() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listProdutos);
  const fetchCats = useServerFn(listCategorias);
  const createFn = useServerFn(createProduto);
  const updateFn = useServerFn(updateProduto);
  const activeFn = useServerFn(setProdutoActive);
  const availFn = useServerFn(setProdutoAvailable);

  const [editing, setEditing] = useState<Produto | "new" | null>(null);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({ queryKey: ["produtos"], queryFn: () => fetchFn({}) });
  const { data: categorias = [] } = useQuery({ queryKey: ["categorias"], queryFn: () => fetchCats({}) });

  const list = useMemo(() => {
    if (!data) return [];
    return (data as Produto[]).filter((p) => {
      if (catFilter !== "all" && p.category_id !== catFilter) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [data, q, catFilter]);

  const saveM = useMutation({
    mutationFn: async (d: any) => {
      if (d.id) await updateFn({ data: d });
      else await createFn({ data: d });
    },
    onSuccess: () => { toast.success("Produto salvo"); qc.invalidateQueries({ queryKey: ["produtos"] }); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const activeM = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => activeFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
  });
  const availM = useMutation({
    mutationFn: (v: { id: string; available: boolean }) => availFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">{isLoading ? "Carregando..." : `${(data ?? []).length} cadastrados`}</p>
        </div>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo produto</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome"
          className="w-full rounded-lg border border-input bg-card pl-9 pr-3 py-2.5 text-sm" />
      </div>

      {/* Filtro categorias */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <button onClick={() => setCatFilter("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${catFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70"}`}>
          Todas
        </button>
        {(categorias as any[]).map((c) => (
          <button key={c.id} onClick={() => setCatFilter(c.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${catFilter === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70"}`}>
            {c.name}
          </button>
        ))}
      </div>

      {isLoading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-muted-foreground" /> : (
        <ul className="space-y-2">
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="h-14 w-14 shrink-0 rounded-lg bg-primary-soft text-primary overflow-hidden flex items-center justify-center">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-tight truncate">{p.name}</p>
                  <p className="font-display font-semibold text-primary tabular-nums shrink-0">{brl(Number(p.price))}</p>
                </div>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  {!p.active && <span className="text-[10px] uppercase rounded-full bg-destructive/10 text-destructive px-2 py-0.5">Inativo</span>}
                  {!p.available && <span className="text-[10px] uppercase rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">Esgotado</span>}
                  <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button title={p.available ? "Marcar esgotado" : "Disponibilizar"} onClick={() => availM.mutate({ id: p.id, available: !p.available })} className={`p-2 rounded-md hover:bg-muted ${p.available ? "text-emerald-600" : "text-amber-600"}`}>
                  {p.available ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button onClick={() => setEditing(p)} className="p-2 rounded-md hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => activeM.mutate({ id: p.id, active: !p.active })} className={`p-2 rounded-md hover:bg-muted ${p.active ? "text-muted-foreground" : "text-primary"}`}><Power className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
          {list.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhum produto.</div>
          )}
        </ul>
      )}

      {editing && (
        <ProdutoDialog initial={editing === "new" ? null : editing} categorias={categorias as any[]}
          loading={saveM.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(d: any) => saveM.mutate({ id: editing === "new" ? undefined : editing.id, ...d })} />
      )}
    </div>
  );
}

function ProdutoDialog({ initial, categorias, onClose, onSubmit, loading }: any) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [stock, setStock] = useState(initial?.stock ?? 0);
  const [category_id, setCategory] = useState<string>(initial?.category_id ?? "");
  const [image_url, setImage] = useState<string | null>(initial?.image_url ?? null);
  const [available, setAvailable] = useState(initial?.available ?? true);
  const [active, setActive] = useState(initial?.active ?? true);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFn = useServerFn(uploadProdutoImage);
  const [uploading, setUploading] = useState(false);

  // Adicionais picker
  const qc = useQueryClient();
  const listGrupos = useServerFn(listAdicionaisGrupos);
  const getLinks = useServerFn(getProdutoAdicionais);
  const setLinks = useServerFn(setProdutoAdicionais);
  const { data: grupos = [] } = useQuery({ queryKey: ["adicionais"], queryFn: () => listGrupos({}) });
  const { data: linked = [] } = useQuery({
    queryKey: ["produto-adicionais", initial?.id],
    queryFn: () => getLinks({ data: { produto_id: initial.id } }),
    enabled: !!initial?.id,
  });
  const [selectedGrupos, setSelectedGrupos] = useState<string[]>([]);
  // sync once
  useMemo(() => { if (initial?.id && (linked as any[]).length) setSelectedGrupos((linked as any[]).map((g) => g.id)); }, [linked, initial?.id]);

  async function handleFile(f: File) {
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataB64: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(f);
      });
      const { url } = await uploadFn({ data: { filename: f.name, contentType: f.type || "image/jpeg", dataBase64: dataB64 } });
      setImage(url);
    } catch (e: any) { toast.error(e?.message ?? "Erro no upload"); }
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name, description: description || null, price: Number(price),
      stock: Number(stock), category_id: category_id || null,
      image_url, available, active,
    });
    if (initial?.id) {
      try { await setLinks({ data: { produto_id: initial.id, grupo_ids: selectedGrupos } }); qc.invalidateQueries({ queryKey: ["produto-adicionais"] }); }
      catch (err: any) { toast.error(err?.message ?? "Erro nos adicionais"); }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-background rounded-t-2xl sm:rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{initial ? "Editar" : "Novo"} produto</h2>
        <form onSubmit={submit} className="space-y-3">
          {/* Imagem */}
          <div className="flex items-center gap-3">
            <div className="h-20 w-20 rounded-lg bg-muted overflow-hidden flex items-center justify-center text-muted-foreground">
              {image_url ? <img src={image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6" />}
            </div>
            <div className="flex-1 space-y-1">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium">
                {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {image_url ? "Trocar imagem" : "Enviar imagem"}
              </button>
              {image_url && <button type="button" onClick={() => setImage(null)} className="ml-2 text-xs text-rose-500">Remover</button>}
            </div>
          </div>

          <label className="block"><span className="text-sm font-medium">Nome</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-sm font-medium">Descrição</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="text-sm font-medium">Preço (R$)</span>
              <input required type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
            <label className="block"><span className="text-sm font-medium">Estoque</span>
              <input type="number" min={0} value={stock} onChange={(e) => setStock(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          </div>
          <label className="block"><span className="text-sm font-medium">Categoria</span>
            <select value={category_id} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">— Sem categoria —</option>
              {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} /> Disponível</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo no catálogo</label>
          </div>

          {initial?.id && (grupos as any[]).length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Grupos de adicionais</p>
              <div className="space-y-1.5">
                {(grupos as any[]).map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm rounded-lg border border-border bg-card px-3 py-2">
                    <input type="checkbox" checked={selectedGrupos.includes(g.id)}
                      onChange={(e) => setSelectedGrupos(e.target.checked ? [...selectedGrupos, g.id] : selectedGrupos.filter((x) => x !== g.id))} />
                    <span className="flex-1">{g.name}</span>
                    <span className="text-xs text-muted-foreground">{g.opcoes.length} opções</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">Cancelar</button>
            <button disabled={loading || uploading} className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
