import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listProdutos, createProduto, updateProduto,
  setProdutoActive, setProdutoAvailable, uploadProdutoImage,
} from "@/lib/produtos.functions";
import {
  listCategorias, upsertCategoria, deleteCategoria, reorderCategorias,
} from "@/lib/categorias.functions";
import {
  listAdicionaisGrupos, upsertAdicionalGrupo, upsertAdicionalOpcao,
  getProdutoAdicionais, setProdutoAdicionais,
} from "@/lib/adicionais.functions";
import { listCombos, upsertCombo, deleteCombo } from "@/lib/combos.functions";
import {
  Loader2, Plus, Search, Pencil, Power, Image as ImageIcon, EyeOff, Eye,
  Package, Tag, X, GripVertical, Copy, Layers, Package2, Trash2, Sparkles,
} from "lucide-react";
import { qk } from "@/lib/query-keys";

export const Route = createFileRoute("/_app/cardapio")({
  component: CardapioPage,
  head: () => ({ meta: [{ title: "Cardápio — ORDEX" }] }),
});

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Produto = {
  id: string; name: string; description: string | null; price: number;
  active: boolean; available: boolean; image_url: string | null;
  category_id: string | null; stock: number;
};
type Categoria = { id: string; name: string; sort_order: number; active: boolean };
type Combo = {
  id: string; name: string; description: string | null; price: number;
  active: boolean; image_url: string | null;
  itens: { combo_id: string; produto_id: string; quantity: number; produto?: { id: string; name: string } }[];
};

function CardapioPage() {
  const qc = useQueryClient();
  const fetchProdutos = useServerFn(listProdutos);
  const fetchCats = useServerFn(listCategorias);
  const fetchCombos = useServerFn(listCombos);

  const { data: produtos = [], isLoading: loadingP } = useQuery({ queryKey: qk.produtos, queryFn: () => fetchProdutos({}) });
  const { data: categorias = [] } = useQuery({ queryKey: qk.categorias, queryFn: () => fetchCats({}) });
  const { data: combos = [] } = useQuery({ queryKey: qk.combos, queryFn: () => fetchCombos({}) });

  const [tab, setTab] = useState<"produtos" | "combos">("produtos");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [avail, setAvail] = useState<"all" | "ok" | "out">("all");
  const [editingProd, setEditingProd] = useState<Produto | "new" | null>(null);
  const [editingCombo, setEditingCombo] = useState<Combo | "new" | null>(null);
  const [editingCat, setEditingCat] = useState<Categoria | "new" | null>(null);

  const list = useMemo(() => {
    return (produtos as Produto[]).filter((p) => {
      if (catFilter !== "all" && p.category_id !== catFilter) return false;
      if (avail === "ok" && !p.available) return false;
      if (avail === "out" && p.available) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [produtos, q, catFilter, avail]);

  const countByCat = useMemo(() => {
    const m: Record<string, number> = { all: (produtos as Produto[]).length };
    (produtos as Produto[]).forEach((p) => {
      if (p.category_id) m[p.category_id] = (m[p.category_id] || 0) + 1;
    });
    return m;
  }, [produtos]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Cardápio</h1>
          <p className="text-sm text-muted-foreground">
            {(produtos as Produto[]).length} produtos · {(categorias as Categoria[]).length} categorias · {(combos as unknown as Combo[]).length} combos
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "produtos" ? (
            <button onClick={() => setEditingProd("new")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card">
              <Plus className="h-4 w-4" /><span className="hidden sm:inline">Novo produto</span>
            </button>
          ) : (
            <button onClick={() => setEditingCombo("new")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card">
              <Plus className="h-4 w-4" /><span className="hidden sm:inline">Novo combo</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
        <button onClick={() => setTab("produtos")}
          className={`px-3 py-1.5 rounded-md font-medium transition ${tab === "produtos" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          <Package className="inline h-4 w-4 mr-1" /> Produtos
        </button>
        <button onClick={() => setTab("combos")}
          className={`px-3 py-1.5 rounded-md font-medium transition ${tab === "combos" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          <Package2 className="inline h-4 w-4 mr-1" /> Combos
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar categorias */}
        <CategoriaSidebar
          categorias={categorias as Categoria[]}
          countByCat={countByCat}
          active={catFilter}
          onPick={setCatFilter}
          onNew={() => setEditingCat("new")}
          onEdit={(c) => setEditingCat(c)}
        />

        {/* Main */}
        <div className="space-y-3 min-w-0">
          {/* Search + filters */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome"
              className="w-full rounded-lg border border-input bg-card pl-9 pr-3 py-2.5 text-sm" />
          </div>

          {tab === "produtos" && (
            <div className="flex gap-2 text-xs">
              {[
                { k: "all", l: "Todos" }, { k: "ok", l: "Disponíveis" }, { k: "out", l: "Esgotados" },
              ].map((f) => (
                <button key={f.k} onClick={() => setAvail(f.k as any)}
                  className={`px-2.5 py-1 rounded-full font-medium ${avail === f.k ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70"}`}>
                  {f.l}
                </button>
              ))}
            </div>
          )}

          {tab === "produtos" ? (
            <ProdutoGrid
              loading={loadingP}
              produtos={list}
              combos={combos as unknown as Combo[]}
              onEdit={(p) => setEditingProd(p)}
            />
          ) : (
            <ComboGrid combos={combos as unknown as Combo[]} onEdit={(c) => setEditingCombo(c)} />
          )}
        </div>
      </div>

      {editingProd && (
        <ProdutoDrawer
          initial={editingProd === "new" ? null : editingProd}
          categorias={categorias as Categoria[]}
          onClose={() => setEditingProd(null)}
          onDone={() => { qc.invalidateQueries({ queryKey: qk.produtos }); setEditingProd(null); }}
        />
      )}
      {editingCombo && (
        <ComboDrawer
          initial={editingCombo === "new" ? null : editingCombo}
          produtos={produtos as Produto[]}
          onClose={() => setEditingCombo(null)}
          onDone={() => { qc.invalidateQueries({ queryKey: qk.combos }); setEditingCombo(null); }}
        />
      )}
      {editingCat && (
        <CategoriaDrawer
          initial={editingCat === "new" ? null : editingCat}
          onClose={() => setEditingCat(null)}
          onDone={() => { qc.invalidateQueries({ queryKey: qk.categorias }); setEditingCat(null); }}
        />
      )}
    </div>
  );
}

/* ===================== CATEGORIA SIDEBAR ===================== */

function CategoriaSidebar({ categorias, countByCat, active, onPick, onNew, onEdit }: {
  categorias: Categoria[]; countByCat: Record<string, number>;
  active: string; onPick: (id: string) => void; onNew: () => void; onEdit: (c: Categoria) => void;
}) {
  const qc = useQueryClient();
  const reorderFn = useServerFn(reorderCategorias);
  const [order, setOrder] = useState<Categoria[] | null>(null);
  const items = order ?? categorias;
  const dragId = useRef<string | null>(null);

  const reorderM = useMutation({
    mutationFn: (ids: string[]) => reorderFn({ data: { ids } }),
    onSuccess: () => { toast.success("Ordem salva"); qc.invalidateQueries({ queryKey: qk.categorias }); setOrder(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  function onDragStart(id: string) { dragId.current = id; }
  function onDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId.current || dragId.current === overId) return;
    const cur = (order ?? categorias).slice();
    const from = cur.findIndex((c) => c.id === dragId.current);
    const to = cur.findIndex((c) => c.id === overId);
    if (from < 0 || to < 0) return;
    const [m] = cur.splice(from, 1);
    cur.splice(to, 0, m);
    setOrder(cur);
  }
  function onDragEnd() {
    if (order) reorderM.mutate(order.map((c) => c.id));
    dragId.current = null;
  }

  return (
    <aside className="rounded-xl border border-border bg-card p-2 shadow-card h-fit lg:sticky lg:top-4">
      <div className="flex items-center justify-between px-2 py-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categorias</p>
        <button onClick={onNew} className="p-1 rounded-md hover:bg-muted text-primary" title="Nova categoria">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <ul className="space-y-0.5">
        <li>
          <button onClick={() => onPick("all")}
            className={`w-full flex items-center justify-between rounded-md px-2 py-2 text-sm ${active === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <span className="font-medium">Todas</span>
            <span className="text-xs opacity-70">{countByCat.all ?? 0}</span>
          </button>
        </li>
        {items.map((c) => (
          <li key={c.id}
            draggable
            onDragStart={() => onDragStart(c.id)}
            onDragOver={(e) => onDragOver(e, c.id)}
            onDragEnd={onDragEnd}
            className="group">
            <div className={`flex items-center gap-1 rounded-md px-1 py-1.5 ${active === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <GripVertical className={`h-3.5 w-3.5 shrink-0 cursor-grab ${active === c.id ? "opacity-70" : "opacity-30 group-hover:opacity-100"}`} />
              <button onClick={() => onPick(c.id)} className="flex-1 flex items-center justify-between text-left text-sm min-w-0">
                <span className="truncate">{c.name}{!c.active && <span className="ml-1 text-[10px] opacity-60">·off</span>}</span>
                <span className="text-xs opacity-70 ml-2">{countByCat[c.id] ?? 0}</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); onEdit(c); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background/30">
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-muted-foreground px-2 py-3 text-center">Nenhuma categoria</li>
        )}
      </ul>
    </aside>
  );
}

/* ===================== PRODUTO GRID ===================== */

function ProdutoGrid({ loading, produtos, combos, onEdit }: {
  loading: boolean; produtos: Produto[]; combos: Combo[]; onEdit: (p: Produto) => void;
}) {
  const qc = useQueryClient();
  const activeFn = useServerFn(setProdutoActive);
  const availFn = useServerFn(setProdutoAvailable);
  const createFn = useServerFn(createProduto);

  const activeM = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => activeFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.produtos }),
  });
  const availM = useMutation({
    mutationFn: (v: { id: string; available: boolean }) => availFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.produtos }),
  });
  const dupM = useMutation({
    mutationFn: (p: Produto) => createFn({ data: {
      name: `${p.name} (cópia)`, description: p.description, price: Number(p.price),
      active: p.active, available: p.available, image_url: p.image_url,
      category_id: p.category_id, stock: Number(p.stock || 0),
    } }),
    onSuccess: () => { toast.success("Produto duplicado"); qc.invalidateQueries({ queryKey: qk.produtos }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  // produtos que estão em algum combo (badge "Em combo")
  const inComboIds = useMemo(() => {
    const s = new Set<string>();
    combos.forEach((c) => c.itens?.forEach((i) => s.add(i.produto_id)));
    return s;
  }, [combos]);

  if (loading) return <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-muted-foreground" />;
  if (!produtos.length) {
    return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhum produto.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {produtos.map((p) => (
        <div key={p.id} className="group rounded-xl border border-border bg-card overflow-hidden shadow-card hover:shadow-elevated transition">
          <div className="relative aspect-[4/3] bg-muted">
            {p.image_url
              ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
              : <div className="h-full w-full flex items-center justify-center text-muted-foreground"><ImageIcon className="h-8 w-8" /></div>}
            <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
              {!p.available && <span className="text-[10px] uppercase font-semibold rounded bg-amber-500/95 text-white px-1.5 py-0.5">Esgotado</span>}
              {!p.active && <span className="text-[10px] uppercase font-semibold rounded bg-destructive/95 text-white px-1.5 py-0.5">Inativo</span>}
              {inComboIds.has(p.id) && <span className="text-[10px] uppercase font-semibold rounded bg-primary/90 text-primary-foreground px-1.5 py-0.5">Em combo</span>}
            </div>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-tight line-clamp-1">{p.name}</p>
              <p className="font-display font-semibold text-primary tabular-nums shrink-0">{brl(Number(p.price))}</p>
            </div>
            {p.description && <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>}
            <div className="flex items-center gap-1 pt-1">
              <button onClick={() => availM.mutate({ id: p.id, available: !p.available })}
                title={p.available ? "Marcar esgotado" : "Disponibilizar"}
                className={`p-1.5 rounded-md hover:bg-muted ${p.available ? "text-emerald-600" : "text-amber-600"}`}>
                {p.available ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button onClick={() => onEdit(p)} title="Editar" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => dupM.mutate(p)} title="Duplicar" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <Copy className="h-4 w-4" />
              </button>
              <button onClick={() => activeM.mutate({ id: p.id, active: !p.active })} title={p.active ? "Desativar" : "Ativar"}
                className={`p-1.5 rounded-md hover:bg-muted ml-auto ${p.active ? "text-muted-foreground" : "text-primary"}`}>
                <Power className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===================== COMBO GRID ===================== */

function ComboGrid({ combos, onEdit }: { combos: Combo[]; onEdit: (c: Combo) => void; }) {
  const qc = useQueryClient();
  const delFn = useServerFn(deleteCombo);
  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.combos }),
  });
  if (!combos.length) {
    return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhum combo.</div>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {combos.map((c) => (
        <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
          <div className="relative aspect-[4/3] bg-muted">
            {c.image_url
              ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
              : <div className="h-full w-full flex items-center justify-center text-muted-foreground"><Package2 className="h-8 w-8" /></div>}
            <span className="absolute top-2 left-2 text-[10px] uppercase font-semibold rounded bg-primary/90 text-primary-foreground px-1.5 py-0.5">Combo</span>
            {!c.active && <span className="absolute top-2 right-2 text-[10px] uppercase font-semibold rounded bg-destructive/95 text-white px-1.5 py-0.5">Inativo</span>}
          </div>
          <div className="p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium line-clamp-1">{c.name}</p>
              <p className="font-display font-semibold text-primary tabular-nums shrink-0">{brl(Number(c.price))}</p>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {c.itens?.map((i) => `${i.quantity}× ${i.produto?.name ?? ""}`).join(" · ") || "Sem itens"}
            </p>
            <div className="flex items-center gap-1 pt-1">
              <button onClick={() => onEdit(c)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => confirm(`Excluir combo "${c.name}"?`) && delM.mutate(c.id)} className="p-1.5 rounded-md hover:bg-muted text-rose-500 ml-auto"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===================== CATEGORIA DRAWER ===================== */

function CategoriaDrawer({ initial, onClose, onDone }: {
  initial: Categoria | null; onClose: () => void; onDone: () => void;
}) {
  const upFn = useServerFn(upsertCategoria);
  const delFn = useServerFn(deleteCategoria);
  const [name, setName] = useState(initial?.name ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const saveM = useMutation({
    mutationFn: () => upFn({ data: { id: initial?.id, name, sort_order: initial?.sort_order ?? 0, active } }),
    onSuccess: () => { toast.success("Categoria salva"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delM = useMutation({
    mutationFn: () => delFn({ data: { id: initial!.id } }),
    onSuccess: () => { toast.success("Categoria removida"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  return (
    <SideDrawer title={initial ? "Editar categoria" : "Nova categoria"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); saveM.mutate(); }} className="space-y-3">
        <label className="block"><span className="text-sm font-medium">Nome</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativa</label>
        <div className="flex gap-2 pt-2">
          {initial && (
            <button type="button" onClick={() => confirm(`Excluir "${initial.name}"?`) && delM.mutate()}
              className="rounded-lg border border-rose-200 text-rose-600 px-3 py-2 text-sm">Excluir</button>
          )}
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">Cancelar</button>
          <button disabled={saveM.isPending} className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saveM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </SideDrawer>
  );
}

/* ===================== PRODUTO DRAWER ===================== */

function ProdutoDrawer({ initial, categorias, onClose, onDone }: {
  initial: Produto | null; categorias: Categoria[]; onClose: () => void; onDone: () => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createProduto);
  const updateFn = useServerFn(updateProduto);
  const uploadFn = useServerFn(uploadProdutoImage);
  const listGruposFn = useServerFn(listAdicionaisGrupos);
  const getLinksFn = useServerFn(getProdutoAdicionais);
  const setLinksFn = useServerFn(setProdutoAdicionais);
  const upGrupoFn = useServerFn(upsertAdicionalGrupo);
  const upOpcaoFn = useServerFn(upsertAdicionalOpcao);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState<number>(initial?.price ?? 0);
  const [category_id, setCategory] = useState<string>(initial?.category_id ?? "");
  const [image_url, setImage] = useState<string | null>(initial?.image_url ?? null);
  const [available, setAvailable] = useState(initial?.available ?? true);
  const [active, setActive] = useState(initial?.active ?? true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: grupos = [] } = useQuery({ queryKey: qk.adicionais, queryFn: () => listGruposFn({}) });
  const { data: linked = [] } = useQuery({
    queryKey: ["produto-adicionais", initial?.id],
    queryFn: () => getLinksFn({ data: { produto_id: initial!.id } }),
    enabled: !!initial?.id,
  });
  const [selectedGrupos, setSelectedGrupos] = useState<string[]>([]);
  const [syncedLinks, setSyncedLinks] = useState(false);
  useMemo(() => {
    if (!syncedLinks && initial?.id && (linked as any[]).length) {
      setSelectedGrupos((linked as any[]).map((g) => g.id));
      setSyncedLinks(true);
    }
  }, [linked, initial?.id, syncedLinks]);

  const [showNewGrupo, setShowNewGrupo] = useState(false);
  const [newGrupoName, setNewGrupoName] = useState("");
  const [newGrupoReq, setNewGrupoReq] = useState(false);
  const [newGrupoMin, setNewGrupoMin] = useState(0);
  const [newGrupoMax, setNewGrupoMax] = useState(1);
  const [newOpcoes, setNewOpcoes] = useState<{ name: string; price: number }[]>([{ name: "", price: 0 }]);

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

  const createGrupoM = useMutation({
    mutationFn: async () => {
      const { id } = await upGrupoFn({ data: {
        name: newGrupoName, required: newGrupoReq, min_select: newGrupoMin, max_select: Math.max(1, newGrupoMax),
      } });
      const valid = newOpcoes.filter((o) => o.name.trim());
      await Promise.all(valid.map((o) => upOpcaoFn({ data: {
        grupo_id: id, name: o.name.trim(), price: Number(o.price) || 0, active: true,
      } })));
      return id;
    },
    onSuccess: (id) => {
      toast.success("Grupo criado");
      setSelectedGrupos((s) => [...s, id]);
      setNewGrupoName(""); setNewGrupoReq(false); setNewGrupoMin(0); setNewGrupoMax(1);
      setNewOpcoes([{ name: "", price: 0 }]); setShowNewGrupo(false);
      qc.invalidateQueries({ queryKey: qk.adicionais });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const saveM = useMutation({
    mutationFn: async () => {
      const payload = {
        name, description: description || null, price: Number(price),
        stock: Number(initial?.stock ?? 0), category_id: category_id || null,
        image_url, available, active,
      };
      let prodId = initial?.id;
      if (prodId) {
        await updateFn({ data: { id: prodId, ...payload } });
      } else {
        const { id } = await createFn({ data: payload });
        prodId = id;
      }
      if (prodId) {
        await setLinksFn({ data: { produto_id: prodId, grupo_ids: selectedGrupos } });
      }
    },
    onSuccess: () => { toast.success("Produto salvo"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <SideDrawer title={initial ? "Editar produto" : "Novo produto"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); saveM.mutate(); }} className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-20 w-20 rounded-lg bg-muted overflow-hidden flex items-center justify-center text-muted-foreground">
            {image_url ? <img src={image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6" />}
          </div>
          <div className="flex-1 space-y-1">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium">
              {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {image_url ? "Trocar imagem" : "Enviar imagem"}
            </button>
            {image_url && <button type="button" onClick={() => setImage(null)} className="ml-2 text-xs text-rose-500">Remover</button>}
          </div>
        </div>

        <label className="block"><span className="text-sm font-medium">Nome</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>

        <label className="block"><span className="text-sm font-medium">Descrição</span>
          <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="text-sm font-medium">Preço (R$)</span>
            <input required type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-sm font-medium">Categoria</span>
            <select value={category_id} onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">— Sem categoria —</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
        </div>

        <div className="flex gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} /> Disponível</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo</label>
        </div>

        {/* Adicionais */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-1"><Layers className="h-4 w-4" /> Grupos de adicionais</p>
            <button type="button" onClick={() => setShowNewGrupo((s) => !s)} className="text-xs text-primary inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Criar grupo
            </button>
          </div>

          {(grupos as any[]).length === 0 && !showNewGrupo && (
            <p className="text-xs text-muted-foreground">Nenhum grupo. Crie um novo acima.</p>
          )}

          {(grupos as any[]).map((g) => (
            <label key={g.id} className="flex items-center gap-2 text-sm rounded-md border border-border bg-background px-3 py-2">
              <input type="checkbox" checked={selectedGrupos.includes(g.id)}
                onChange={(e) => setSelectedGrupos(e.target.checked
                  ? [...selectedGrupos, g.id]
                  : selectedGrupos.filter((x) => x !== g.id))} />
              <span className="flex-1 truncate">{g.name}</span>
              <span className="text-xs text-muted-foreground">
                {g.required ? "obrig · " : ""}{g.min_select}-{g.max_select} · {(g.opcoes ?? []).length} opç.
              </span>
            </label>
          ))}

          {showNewGrupo && (
            <div className="rounded-md border border-dashed border-border p-3 space-y-2 bg-muted/30">
              <input placeholder="Nome do grupo (ex: Ponto da carne)" value={newGrupoName} onChange={(e) => setNewGrupoName(e.target.value)}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm" />
              <div className="grid grid-cols-3 gap-2 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={newGrupoReq} onChange={(e) => setNewGrupoReq(e.target.checked)} /> Obrig.</label>
                <label className="flex items-center gap-1">Min <input type="number" min={0} value={newGrupoMin} onChange={(e) => setNewGrupoMin(Number(e.target.value))} className="w-12 rounded border border-input bg-background px-1 py-0.5" /></label>
                <label className="flex items-center gap-1">Max <input type="number" min={1} value={newGrupoMax} onChange={(e) => setNewGrupoMax(Number(e.target.value))} className="w-12 rounded border border-input bg-background px-1 py-0.5" /></label>
              </div>
              <div className="space-y-1">
                {newOpcoes.map((o, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <input placeholder="Opção" value={o.name} onChange={(e) => setNewOpcoes(newOpcoes.map((x, ix) => ix === i ? { ...x, name: e.target.value } : x))} className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs" />
                    <input type="number" step="0.01" placeholder="0,00" value={o.price} onChange={(e) => setNewOpcoes(newOpcoes.map((x, ix) => ix === i ? { ...x, price: Number(e.target.value) } : x))} className="w-20 rounded border border-input bg-background px-2 py-1 text-xs" />
                    <button type="button" onClick={() => setNewOpcoes(newOpcoes.filter((_, ix) => ix !== i))} className="text-rose-500 p-1"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setNewOpcoes([...newOpcoes, { name: "", price: 0 }])} className="text-xs text-primary">+ Opção</button>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowNewGrupo(false)} className="text-xs px-2 py-1 rounded border border-border">Cancelar</button>
                <button type="button" disabled={!newGrupoName.trim() || createGrupoM.isPending} onClick={() => createGrupoM.mutate()}
                  className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground inline-flex items-center gap-1 disabled:opacity-60">
                  {createGrupoM.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Criar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">Cancelar</button>
          <button disabled={saveM.isPending || uploading}
            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saveM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </SideDrawer>
  );
}

/* ===================== COMBO DRAWER ===================== */

function ComboDrawer({ initial, produtos, onClose, onDone }: {
  initial: Combo | null; produtos: Produto[]; onClose: () => void; onDone: () => void;
}) {
  const upFn = useServerFn(upsertCombo);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState<number>(initial?.price ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);
  const [itens, setItens] = useState<{ produto_id: string; quantity: number }[]>(
    initial?.itens?.map((i) => ({ produto_id: i.produto_id, quantity: i.quantity })) ?? []
  );
  const [picker, setPicker] = useState("");

  const saveM = useMutation({
    mutationFn: () => upFn({ data: {
      id: initial?.id, name, description: description || null, price: Number(price),
      active, image_url: initial?.image_url ?? null, itens,
    } }),
    onSuccess: () => { toast.success("Combo salvo"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  function add() {
    if (!picker || itens.find((i) => i.produto_id === picker)) return;
    setItens([...itens, { produto_id: picker, quantity: 1 }]);
    setPicker("");
  }

  return (
    <SideDrawer title={initial ? "Editar combo" : "Novo combo"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); saveM.mutate(); }} className="space-y-3">
        <label className="block"><span className="text-sm font-medium">Nome</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
        <label className="block"><span className="text-sm font-medium">Descrição</span>
          <input value={description ?? ""} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
        <label className="block"><span className="text-sm font-medium">Preço (R$)</span>
          <input required type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo</label>

        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-sm font-semibold">Itens do combo</p>
          <div className="flex gap-2">
            <select value={picker} onChange={(e) => setPicker(e.target.value)} className="flex-1 rounded-lg border border-input bg-background px-2 py-2 text-sm">
              <option value="">— Selecionar produto —</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" onClick={add} className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">+</button>
          </div>
          <ul className="space-y-1.5">
            {itens.map((i, idx) => {
              const p = produtos.find((pp) => pp.id === i.produto_id);
              return (
                <li key={i.produto_id} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                  <span className="flex-1 truncate">{p?.name ?? "?"}</span>
                  <input type="number" min={1} value={i.quantity}
                    onChange={(e) => { const q = Math.max(1, Number(e.target.value)); setItens(itens.map((x, ix) => ix === idx ? { ...x, quantity: q } : x)); }}
                    className="w-14 rounded border border-input bg-background px-2 py-1 text-sm" />
                  <button type="button" onClick={() => setItens(itens.filter((_, ix) => ix !== idx))} className="text-rose-500"><X className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">Cancelar</button>
          <button disabled={saveM.isPending}
            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saveM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </SideDrawer>
  );
}

/* ===================== SIDE DRAWER ===================== */

function SideDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-screen overflow-y-auto bg-background sm:rounded-l-2xl p-5 shadow-elevated animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
