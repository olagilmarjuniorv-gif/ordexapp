import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listClientes } from "@/lib/clientes.functions";
import { listProdutos } from "@/lib/produtos.functions";
import { upsertOrcamento } from "@/lib/orcamentos.functions";
import { Loader2, Trash2, Plus, ChevronsUpDown } from "lucide-react";

export const Route = createFileRoute("/_app/orcamentos/novo")({
  component: OrcamentoForm,
  head: () => ({ meta: [{ title: "Novo Orçamento — ObraGestor" }] }),
});

function formatBRL(value: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// Simplified Combobox for selecting client and products
function Combobox({ options, value, onChange, placeholder }: any) {
    return (
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
            <option value="">{placeholder}</option>
            {options.map((opt: any) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
        </select>
    )
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

    const { data: clientes, isLoading: loadingClientes } = useQuery({ queryKey: ['clientes'], queryFn: () => clienteFn({}) });
    const { data: produtos, isLoading: loadingProdutos } = useQuery({ queryKey: ['produtos'], queryFn: () => produtoFn({}) });

    const saveM = useMutation({
        mutationFn: (data: any) => upsertFn({ data }),
        onSuccess: (res: any) => {
            toast.success("Orçamento salvo!");
            qc.invalidateQueries({ queryKey: ['orcamentos'] });
            navigate({ to: `/orcamentos/${res.id}` });
        },
        onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });

    const total = items.reduce((acc, item) => acc + item.quantity * item.price, 0);

    function handleAddProduct(productId: string) {
        const product = produtos.find((p: any) => p.id === productId);
        if (product && !items.find(i => i.product_id === productId)) {
            setItems([...items, { product_id: product.id, name: product.name, quantity: 1, price: product.price }]);
        }
    }

    function handleItemChange(index: number, field: string, value: any) {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!clientId) { toast.error("Selecione um cliente"); return; }
        if (items.length === 0) { toast.error("Adicione pelo menos um item"); return; }
        saveM.mutate({ client_id: clientId, items, valid_until: validUntil || null });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
            <div className="space-y-2">
                 <h1 className="font-display text-2xl lg:text-3xl font-bold">Novo Orçamento</h1>
                 <p className="text-sm text-muted-foreground">Preencha os dados para criar o orçamento.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Cliente">
                    {loadingClientes ? <Loader2 className="h-4 w-4 animate-spin"/> : 
                        <Combobox options={clientes} value={clientId} onChange={setClientId} placeholder="Selecione..." />}
                </Field>
                 <Field label="Válido até (opcional)">
                    <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={inputCls} />
                </Field>
            </div>

            <div className="space-y-3">
                <h2 className="font-semibold">Itens</h2>
                 {loadingProdutos ? <Loader2 className="h-4 w-4 animate-spin"/> : 
                    <Combobox options={produtos.filter((p: any) => p.active)} value="" onChange={handleAddProduct} placeholder="+ Adicionar produto..." />
                 }
                <ul className="space-y-2">
                    {items.map((item, index) => (
                        <li key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                           <div className="flex-1 font-medium text-sm">{item.name}</div>
                           <div className="w-20"><input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className={inputClsSmall} /></div>
                           <div className="w-24"><input type="number" step="0.01" value={item.price} onChange={e => handleItemChange(index, 'price', Number(e.target.value))} className={inputClsSmall} /></div>
                           <div className="w-28 text-right font-medium tabular-nums">{formatBRL(item.quantity * item.price)}</div>
                           <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
                        </li>
                    ))}
                </ul>
                {items.length > 0 && <div className="text-right font-bold text-lg">Total: {formatBRL(total)}</div>}
            </div>

            <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => navigate({ to: '/orcamentos' })} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-medium">Cancelar</button>
                <button type="submit" disabled={saveM.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70">
                    {saveM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar Rascunho
                </button>
            </div>
        </form>
    )
}

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const inputClsSmall = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
