import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCompanies,
  createCompany,
  updateCompany,
  setCompanyActive,
} from "@/lib/companies.functions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Building2, Plus, Power, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/empresas")({
  component: EmpresasPage,
  head: () => ({ meta: [{ title: "Empresas — ObraGestor" }] }),
});

type Company = {
  id: string;
  name: string;
  slug: string | null;
  phone: string | null;
  active: boolean;
};

function EmpresasPage() {
  const { isSuperAdmin, loading } = useAuth();
  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;
  return <Panel />;
}

function Panel() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listCompanies);
  const createFn = useServerFn(createCompany);
  const updateFn = useServerFn(updateCompany);
  const activeFn = useServerFn(setCompanyActive);
  const [editing, setEditing] = useState<Company | "new" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => fetchFn({}),
  });

  const saveM = useMutation({
    mutationFn: async (d: { id?: string; name: string; slug: string | null; phone: string | null }) => {
      if (d.id) await updateFn({ data: { id: d.id, name: d.name, slug: d.slug, phone: d.phone } });
      else await createFn({ data: { name: d.name, slug: d.slug, phone: d.phone } });
    },
    onSuccess: () => {
      toast.success("Empresa salva");
      qc.invalidateQueries({ queryKey: ["companies"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const activeM = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => activeFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Empresas</h1>
          <p className="text-sm text-muted-foreground">Gerencie as lojas cadastradas no sistema.</p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-elevated"
        >
          <Plus className="h-4 w-4" /> Nova empresa
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((c: Company) => (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{c.name}</p>
                  {!c.active && (
                    <span className="text-[10px] uppercase rounded-full bg-destructive/10 text-destructive px-2 py-0.5">
                      Inativa
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {c.slug ? `@${c.slug}` : "—"}
                  {c.phone ? ` · ${c.phone}` : ""}
                </p>
              </div>
              <button
                onClick={() => setEditing(c)}
                className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => activeM.mutate({ id: c.id, active: !c.active })}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border ${
                  c.active
                    ? "border-border text-muted-foreground hover:bg-muted"
                    : "border-primary/30 text-primary hover:bg-primary/5"
                }`}
              >
                <Power className="h-3.5 w-3.5" />
                {c.active ? "Desativar" : "Ativar"}
              </button>
            </div>
          ))}
          {(data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhuma empresa ainda.</p>
          )}
        </div>
      )}

      {editing && (
        <CompanyDialog
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

function CompanyDialog({
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  initial: Company | null;
  onClose: () => void;
  onSubmit: (d: { name: string; slug: string | null; phone: string | null }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");

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
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">
            {initial ? "Editar empresa" : "Nova empresa"}
          </h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name, slug: slug || null, phone: phone || null });
          }}
          className="space-y-3"
        >
          <Field label="Nome">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Identificador (opcional)">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ex: loja-centro"
              className={inputCls}
            />
          </Field>
          <Field label="Telefone (opcional)">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
