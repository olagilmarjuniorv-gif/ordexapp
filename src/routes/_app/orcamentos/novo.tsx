import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { listClientes, createCliente } from "@/lib/clientes.functions";
import { listProdutos, createProduto } from "@/lib/produtos.functions";
import { upsertOrcamento } from "@/lib/orcamentos.functions";
import { Loader2, Trash2, Plus, Search, UserPlus, PackagePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/orcamentos/novo")({
  component: OrcamentoForm,
  head: () => ({ meta: [{ title: "Novo Orçamento — ORDEX" }] }),
});

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const inputClsSmall =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary";

type Option = { id: string; name: string; [k: string]: any };

/** Search combobox with "create new" affordance. */
function SearchCombobox({
  options,
  value,
  onChange,
  onCreateNew,
  placeholder,
  createLabel,
  loading,
}: {
  options: Option[];
  value: string;
  onChange: (id: string, option?: Option) => void;
  onCreateNew: (query: string) => void;
  placeholder: string;
  createLabel: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.id === value), [options, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [query, options]);

  const exactMatch = filtered.some((o) => o.name.toLowerCase() === query.trim().toLowerCase());
  const showCreate = query.trim().length > 0 && !exactMatch;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls} text-left flex items-center justify-between gap-2`}
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected ? selected.name : placeholder}
        </span>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className={inputClsSmall}
            />
          </div>
          <ul className="max-h-60 overflow-auto py-1">
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.id, o);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                >
                  {o.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 && !showCreate && (
              <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</li>
            )}
            {showCreate && (
              <li className="border-t border-border mt-1">
                <button
                  type="button"
                  onClick={() => {
                    onCreateNew(query.trim());
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-primary hover:bg-accent inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> {createLabel} "{query.trim()}"
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function NewClienteModal({
  open,
  initialName,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (c: Option) => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createCliente);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (open) {
      setName(initialName);
      setEmail("");
      setPhone("");
      setAddress("");
    }
  }, [open, initialName]);

  const m = useMutation({
    mutationFn: (data: any) => createFn({ data }),
    onSuccess: async (res: any) => {
      toast.success("Cliente cadastrado");
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      onCreated({ id: res.id, name });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cadastrar cliente"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nome obrigatório");
    m.mutate({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Novo cliente
          </DialogTitle>
          <DialogDescription>Cadastre um cliente sem sair do orçamento.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nome *">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="E-mail">
              <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Telefone">
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <Field label="Endereço">
            <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <DialogFooter>
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-sm">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={m.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-70"
            >
              {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewProdutoModal({
  open,
  initialName,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (p: Option & { price: number }) => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createProduto);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription("");
      setPrice(0);
    }
  }, [open, initialName]);

  const m = useMutation({
    mutationFn: (data: any) => createFn({ data }),
    onSuccess: async (res: any) => {
      toast.success("Produto cadastrado");
      await qc.invalidateQueries({ queryKey: ["produtos"] });
      onCreated({ id: res.id, name, price });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cadastrar produto"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nome obrigatório");
    if (price < 0) return toast.error("Preço inválido");
    m.mutate({
      name: name.trim(),
      description: description.trim() || null,
      price,
      active: true,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" /> Novo produto
          </DialogTitle>
          <DialogDescription>Cadastre um produto sem sair do orçamento.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nome *">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Descrição">
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Preço (R$) *">
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </Field>
          <DialogFooter>
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-sm">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={m.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-70"
            >
              {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrcamentoForm() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const clienteFn = useServerFn(listClientes);
  const produtoFn = useServerFn(listProdutos);
  const upsertFn = useServerFn(upsertOrcamento);

  const [clientId, setClientId] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [validUntil, setValidUntil] = useState<string>("");

  const [clienteModal, setClienteModal] = useState<{ open: boolean; name: string }>({ open: false, name: "" });
  const [produtoModal, setProdutoModal] = useState<{ open: boolean; name: string }>({ open: false, name: "" });

  const { data: clientes, isLoading: loadingClientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => clienteFn({}),
  });
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => produtoFn({}),
  });

  const produtosAtivos = useMemo(() => (produtos ?? []).filter((p: any) => p.active), [produtos]);

  const saveM = useMutation({
    mutationFn: (data: any) => upsertFn({ data }),
    onSuccess: (res: any) => {
      toast.success("Orçamento salvo!");
      qc.invalidateQueries({ queryKey: ["orcamentos"] });
      navigate({ to: `/orcamentos/${res.id}` });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const total = items.reduce((acc, item) => acc + item.quantity * item.price, 0);

  function addProduct(productId: string, opt?: Option & { price?: number }) {
    if (items.find((i) => i.product_id === productId)) return;
    const product =
      (produtos ?? []).find((p: any) => p.id === productId) ??
      (opt ? { id: opt.id, name: opt.name, price: opt.price ?? 0 } : null);
    if (!product) return;
    setItems((prev) => [
      ...prev,
      { product_id: product.id, name: product.name, quantity: 1, price: Number(product.price) || 0 },
    ]);
  }

  function handleItemChange(index: number, field: string, value: any) {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }
    saveM.mutate({ client_id: clientId, items, valid_until: validUntil || null });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
        <div className="space-y-2">
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Novo Orçamento</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados para criar o orçamento.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Cliente">
            <SearchCombobox
              options={clientes ?? []}
              value={clientId}
              onChange={(id) => setClientId(id)}
              onCreateNew={(name) => setClienteModal({ open: true, name })}
              placeholder="Selecione ou busque..."
              createLabel="Cadastrar novo cliente"
              loading={loadingClientes}
            />
          </Field>
          <Field label="Válido até (opcional)">
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold">Itens</h2>
          <SearchCombobox
            options={produtosAtivos}
            value=""
            onChange={(id, opt) => addProduct(id, opt as any)}
            onCreateNew={(name) => setProdutoModal({ open: true, name })}
            placeholder="+ Buscar ou adicionar produto..."
            createLabel="Cadastrar novo produto"
            loading={loadingProdutos}
          />
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <div className="flex-1 font-medium text-sm">{item.name}</div>
                <div className="w-20">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                    className={inputClsSmall}
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => handleItemChange(index, "price", Number(e.target.value))}
                    className={inputClsSmall}
                  />
                </div>
                <div className="w-28 text-right font-medium tabular-nums">{formatBRL(item.quantity * item.price)}</div>
                <button
                  type="button"
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {items.length > 0 && <div className="text-right font-bold text-lg">Total: {formatBRL(total)}</div>}
        </div>

        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={() => navigate({ to: "/orcamentos" })}
            className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saveM.isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
          >
            {saveM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar Rascunho
          </button>
        </div>
      </form>

      <NewClienteModal
        open={clienteModal.open}
        initialName={clienteModal.name}
        onClose={() => setClienteModal({ open: false, name: "" })}
        onCreated={(c) => setClientId(c.id)}
      />
      <NewProdutoModal
        open={produtoModal.open}
        initialName={produtoModal.name}
        onClose={() => setProdutoModal({ open: false, name: "" })}
        onCreated={(p) => addProduct(p.id, p)}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
