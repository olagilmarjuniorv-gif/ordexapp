import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listProdutos,
  createProduto,
  updateProduto,
  setProdutoActive,
} from "@/lib/produtos.functions";
import {
  Loader2,
  Package,
  Plus,
  Search,
  Pencil,
  Power,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_app/produtos")({
  component: Produtos,
  head: () => ({ meta: [{ title: "Produtos — ORDEX" }] }),
});

type Produto = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
};

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function Produtos() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listProdutos);
  const createFn = useServerFn(createProduto);
  const updateFn = useServerFn(updateProduto);
  const activeFn = useServerFn(setProdutoActive);

  const [editing, setEditing] = useState<Produto | "new" | null>(null);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => fetchFn({}),
  });

  const list = useMemo(() => {
    if (!data) return [];
    return data.filter((p: Produto) =>
      p.name.toLowerCase().includes(q.toLowerCase())
    );
  }, [data, q]);

  const saveM = useMutation({
    mutationFn: async (d: { id?: string; name: string; description: string | null; price: number; active: boolean; }) => {
        if (d.id) await updateFn({ data: { ...d, id: d.id } });
        else await createFn({ data: d });
    },
    onSuccess: () => {
      toast.success("Produto salvo");
      qc.invalidateQueries({ queryKey: ["produtos"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const activeM = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => activeFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando..." : `${(data ?? []).length} cadastrados`}
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo produto</span>
        </button>
      </div>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome"
          className="w-full rounded-lg border border-input bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((p: Produto) => (
             <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-card">
                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-tight truncate">{p.name}</p>
                        <p className="font-display font-semibold text-primary tabular-nums shrink-0">
                          {formatBRL(p.price)}
                        </p>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                        {!p.active && (
                            <span className="text-[10px] uppercase rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-medium">
                                Inativo
                            </span>
                        )}
                         <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-1">
                     <button onClick={() => setEditing(p)} className="p-2 rounded-md hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                     <button onClick={() => activeM.mutate({ id: p.id, active: !p.active })} className={`p-2 rounded-md hover:bg-muted ${p.active ? 'text-muted-foreground' : 'text-primary'}`}><Power className="h-4 w-4" /></button>
                </div>
            </li>
          ))}
          {list.length === 0 && (
             <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Package className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Nenhum produto encontrado</p>
            </div>
          )}
        </ul>
      )}

      {editing && (
        <ProdutoDialog
          initial={editing === "new" ? null : editing}
          loading={saveM.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(d) =>
            saveM.mutate({
              id: editing === "new" ? undefined : editing.id,
              active: editing === "new" ? true : editing.active, // Keep active state on edit
              ...d,
            })
          }
        />
      )}
    </div>
  );
}

function ProdutoDialog({
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  initial: Produto | null;
  onClose: () => void;
  onSubmit: (d: { name: string; description: string | null; price: number; }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial?.price ?? 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-background p-5 shadow-elevated"
      >
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">
            {initial ? "Editar produto" : "Novo produto"}
          </h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name, description: description || null, price });
          }}
          className="space-y-3"
        >
          <Field label="Nome">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
           <Field label="Descrição (opcional)">
            <input value={description ?? ''} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Preço (R$)">
            <input required type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} className={inputCls} />
          </Field>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-medium">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
