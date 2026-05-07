import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Package, AlertTriangle, Pencil, Trash2, Boxes, X } from "lucide-react";
import {
  products as initialProducts,
  productCategories,
  formatBRL,
  type Product,
  type ProductCategory,
} from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/produtos")({
  component: Produtos,
  head: () => ({ meta: [{ title: "Produtos — ObraGestor" }] }),
});

type FormState = {
  name: string;
  price: string;
  stock: string;
  unit: string;
  category: ProductCategory;
  minStock: string;
};

const emptyForm: FormState = {
  name: "",
  price: "",
  stock: "",
  unit: "un",
  category: "Cimento",
  minStock: "",
};

function Produtos() {
  const [items, setItems] = useState<Product[]>(initialProducts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ProductCategory>("all");
  const [onlyLow, setOnlyLow] = useState(false);

  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (onlyLow && p.stock > p.minStock) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, category, onlyLow]);

  const lowCount = items.filter((p) => p.stock <= p.minStock).length;

  const upsert = (form: FormState, id?: string) => {
    const product: Product = {
      id: id ?? `p${Date.now()}`,
      name: form.name.trim(),
      price: Number(form.price.replace(",", ".")) || 0,
      stock: Number(form.stock) || 0,
      unit: form.unit.trim() || "un",
      category: form.category,
      minStock: Number(form.minStock) || 0,
    };
    if (!product.name) {
      toast.error("Informe o nome do produto");
      return false;
    }
    setItems((prev) => (id ? prev.map((p) => (p.id === id ? product : p)) : [product, ...prev]));
    toast.success(id ? "Produto atualizado" : "Produto adicionado");
    return true;
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    toast.success("Produto excluído");
  };

  const adjustStock = (id: string, delta: number) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p)));
    toast.success("Estoque atualizado");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} no catálogo
            {lowCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-warning-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> {lowCount} com estoque baixo
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="shrink-0">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </div>

      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto..."
            className="pl-9 h-11"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>
            Todos
          </Chip>
          {productCategories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
          <button
            type="button"
            onClick={() => setOnlyLow((v) => !v)}
            className={cn(
              "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              onlyLow
                ? "bg-warning/20 text-warning-foreground border-warning/40"
                : "border-border text-muted-foreground"
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Estoque baixo
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Package className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Nenhum produto encontrado</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const low = p.stock <= p.minStock;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="w-full text-left rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-3">
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
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{p.category}</span>
                        <span className="tabular-nums">
                          {p.stock} {p.unit}
                        </span>
                        {low ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-warning-foreground font-medium">
                            <AlertTriangle className="h-3 w-3" /> Estoque baixo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-success font-medium">
                            Em estoque
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Create / edit dialog */}
      <ProductDialog
        open={creating || !!editing}
        product={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={(form) => {
          const ok = upsert(form, editing?.id);
          if (ok) {
            setCreating(false);
            setEditing(null);
          }
        }}
        onAskDelete={() => editing && setConfirmDelete(editing)}
        onAskStock={() => {
          if (editing) {
            setStockTarget(editing);
            setStockDelta("");
          }
        }}
      />

      {/* Stock adjust dialog */}
      <Dialog open={!!stockTarget} onOpenChange={(o) => !o && setStockTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" /> Atualizar estoque
            </DialogTitle>
            <DialogDescription>
              {stockTarget?.name} — atual: {stockTarget?.stock} {stockTarget?.unit}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[-10, -1, +1].map((d) => (
                <Button key={d} variant="outline" onClick={() => setStockDelta(String(d))}>
                  {d > 0 ? `+${d}` : d}
                </Button>
              ))}
              {[+10, +50, +100].map((d) => (
                <Button key={d} variant="outline" onClick={() => setStockDelta(`+${d}`)}>
                  +{d}
                </Button>
              ))}
            </div>
            <div>
              <Label>Ajuste manual (use - para retirar)</Label>
              <Input
                inputMode="numeric"
                value={stockDelta}
                onChange={(e) => setStockDelta(e.target.value)}
                placeholder="Ex.: +20 ou -5"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!stockTarget) return;
                const v = Number(stockDelta.replace("+", ""));
                if (!Number.isFinite(v) || v === 0) {
                  toast.error("Informe um valor válido");
                  return;
                }
                adjustStock(stockTarget.id, v);
                setStockTarget(null);
                setEditing((prev) =>
                  prev && prev.id === stockTarget.id
                    ? { ...prev, stock: Math.max(0, prev.stock + v) }
                    : prev
                );
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir produto?</DialogTitle>
            <DialogDescription>
              {confirmDelete?.name} será removido do catálogo. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete) {
                  remove(confirmDelete.id);
                  setConfirmDelete(null);
                  setEditing(null);
                }
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ProductDialog({
  open,
  product,
  onClose,
  onSubmit,
  onAskDelete,
  onAskStock,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSubmit: (form: FormState) => void;
  onAskDelete: () => void;
  onAskStock: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);

  // sync when opening
  const key = product?.id ?? "new";
  useMemoSync(key, () => {
    setForm(
      product
        ? {
            name: product.name,
            price: String(product.price),
            stock: String(product.stock),
            unit: product.unit,
            category: product.category,
            minStock: String(product.minStock),
          }
        : emptyForm
    );
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex.: Cimento CP II 50kg"
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preço (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="un, sc, m³, lt..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Estoque</Label>
              <Input
                inputMode="numeric"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Estoque mínimo</Label>
              <Input
                inputMode="numeric"
                value={form.minStock}
                onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as ProductCategory }))}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {productCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {product && (
            <div className="flex items-center gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onAskStock}>
                <Boxes className="h-4 w-4" /> Estoque
              </Button>
              <Button type="button" variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={onAskDelete}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button onClick={() => onSubmit(form)}>
            <Pencil className="h-4 w-4" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tiny helper to re-run an init callback when a key changes (sync form state).
function useMemoSync(key: string, fn: () => void) {
  useMemo(() => {
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
