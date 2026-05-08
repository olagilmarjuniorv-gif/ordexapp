import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listClientes,
  createCliente,
  updateCliente,
  deleteCliente,
} from "@/lib/clientes.functions";
import { Loader2, User, Plus, Search, Trash2, Pencil, Phone } from "lucide-react";
import { WhatsappButton } from "@/components/WhatsappButton";

export const Route = createFileRoute("/_app/clientes")({
  component: Clientes,
  head: () => ({ meta: [{ title: "Clientes — ObraGestor" }] }),
});

type Cliente = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

function Clientes() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listClientes);
  const createFn = useServerFn(createCliente);
  const updateFn = useServerFn(updateCliente);
  const deleteFn = useServerFn(deleteCliente);

  const [editing, setEditing] = useState<Cliente | "new" | null>(null);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => fetchFn({}),
  });

  const list = useMemo(() => {
    if (!data) return [];
    return data.filter((c: Cliente) =>
      c.name.toLowerCase().includes(q.toLowerCase())
    );
  }, [data, q]);

  const saveM = useMutation({
    mutationFn: async (d: { id?: string; name: string; email: string | null; phone: string | null; address: string | null }) => {
      if (d.id) await updateFn({ data: { id: d.id, ...d } });
      else await createFn({ data: d });
    },
    onSuccess: () => {
      toast.success("Cliente salvo");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Cliente excluído");
      qc.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando..." : `${(data ?? []).length} cadastrados`}
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo cliente</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
          {list.map((c: Cliente) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary font-bold">
                {c.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {c.phone ? <><Phone className="h-3 w-3" /> {c.phone}</> : c.email}
                </p>
              </div>
              <div className="flex items-center gap-1">
                  <WhatsappButton phone={c.phone} label="" message={`Olá ${c.name}, tudo bem?`} />
                  <button onClick={() => setEditing(c)} className="p-2 rounded-md hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => {
                      if (confirm("Tem certeza que deseja excluir este cliente?")) {
                          deleteM.mutate(c.id)
                      }
                  }} className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
           {list.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhum cliente encontrado.</p>
            )}
        </ul>
      )}

      {editing && (
        <ClienteDialog
          initial={editing === "new" ? null : editing}
          loading={saveM.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(d) =>
            saveM.mutate({
              id: editing === "new" ? undefined : editing.id,
              ...d,
            })
          }
        />
      )}
    </div>
  );
}

function ClienteDialog({
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  initial: Cliente | null;
  onClose: () => void;
  onSubmit: (d: { name: string; email: string | null; phone: string | null; address: string | null; }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");

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
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">
            {initial ? "Editar cliente" : "Novo cliente"}
          </h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name, email: email || null, phone: phone || null, address: address || null });
          }}
          className="space-y-3"
        >
          <Field label="Nome">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email (opcional)">
            <input type="email" value={email ?? ''} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </Field>
           <Field label="Telefone (opcional)">
            <input value={phone ?? ''} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Endereço (opcional)">
            <input value={address ?? ''} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
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
