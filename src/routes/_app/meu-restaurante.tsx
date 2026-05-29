import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Store } from "lucide-react";
import { toast } from "sonner";
import { getCompanyById, updateMeuRestaurante, type HorariosFuncionamento } from "@/lib/companies.functions";
import { listCompanies } from "@/lib/companies.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/meu-restaurante")({
  component: MeuRestaurantePage,
  head: () => ({ meta: [{ title: "Meu Restaurante — SaiuPedido" }] }),
});

const DIAS: { key: keyof HorariosFuncionamento; label: string }[] = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

type FormState = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  delivery_ativo: boolean;
  retirada_ativa: boolean;
  tempo_preparo_min: number;
  pedido_minimo: number;
  taxa_entrega: number;
  horarios: HorariosFuncionamento;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40";

function MeuRestaurantePage() {
  const { isAdmin, isSuperAdmin, companyId, loading } = useAuth();
  const queryClient = useQueryClient();
  const getCompanyByIdFn = useServerFn(getCompanyById);
  const listCompaniesFn = useServerFn(listCompanies);
  const updateFn = useServerFn(updateMeuRestaurante);

  // Super admin pode escolher qualquer empresa
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveId = isSuperAdmin ? selectedId : companyId;

  const companiesList = useQuery({
    queryKey: ["companies", "list"],
    queryFn: () => listCompaniesFn({}),
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    if (isSuperAdmin && !selectedId && companiesList.data?.[0]) {
      setSelectedId(companiesList.data[0].id);
    }
  }, [isSuperAdmin, selectedId, companiesList.data]);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", effectiveId],
    queryFn: () => getCompanyByIdFn({ data: { id: effectiveId ?? undefined } }),
    enabled: !!effectiveId,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company) return;
    setForm({
      id: company.id,
      name: company.name ?? "",
      phone: company.phone ?? "",
      whatsapp: (company as any).whatsapp ?? "",
      email: (company as any).email ?? "",
      cep: (company as any).cep ?? "",
      rua: (company as any).rua ?? "",
      numero: (company as any).numero ?? "",
      complemento: (company as any).complemento ?? "",
      bairro: (company as any).bairro ?? "",
      cidade: (company as any).cidade ?? "",
      estado: (company as any).estado ?? "",
      delivery_ativo: (company as any).delivery_ativo ?? true,
      retirada_ativa: (company as any).retirada_ativa ?? true,
      tempo_preparo_min: (company as any).tempo_preparo_min ?? 30,
      pedido_minimo: Number((company as any).pedido_minimo ?? 0),
      taxa_entrega: Number((company as any).taxa_entrega ?? 0),
      horarios: (company as any).horarios as HorariosFuncionamento,
    });
  }, [company]);

  if (loading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }
  if (!isAdmin && !isSuperAdmin) return <Navigate to="/dashboard" />;

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await updateFn({ data: form });
      toast.success("Dados do restaurante atualizados");
      queryClient.invalidateQueries({ queryKey: ["company"] });
      queryClient.invalidateQueries({ queryKey: ["company-name"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Meu Restaurante</h1>
          <p className="text-sm text-muted-foreground">
            Dados, endereço, operação e horário de funcionamento.
          </p>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="rounded-lg border border-border bg-card p-4">
          <Field label="Empresa (super admin)">
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className={inputCls}
            >
              {(companiesList.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {isLoading || !form ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {/* Dados básicos */}
          <section className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Dados básicos</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do restaurante">
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="E-mail">
                <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Telefone">
                <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="WhatsApp">
                <input className={inputCls} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              </Field>
            </div>
          </section>

          {/* Endereço */}
          <section className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Endereço</h2>
            <div className="grid gap-4 sm:grid-cols-6">
              <div className="sm:col-span-2"><Field label="CEP"><input className={inputCls} value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} /></Field></div>
              <div className="sm:col-span-3"><Field label="Rua"><input className={inputCls} value={form.rua} onChange={(e) => setForm({ ...form, rua: e.target.value })} /></Field></div>
              <div className="sm:col-span-1"><Field label="Número"><input className={inputCls} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></Field></div>
              <div className="sm:col-span-3"><Field label="Complemento"><input className={inputCls} value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} /></Field></div>
              <div className="sm:col-span-3"><Field label="Bairro"><input className={inputCls} value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></Field></div>
              <div className="sm:col-span-4"><Field label="Cidade"><input className={inputCls} value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Estado"><input className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} /></Field></div>
            </div>
          </section>

          {/* Operacional */}
          <section className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Configurações operacionais</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm">Delivery ativo</span>
                <input type="checkbox" checked={form.delivery_ativo} onChange={(e) => setForm({ ...form, delivery_ativo: e.target.checked })} />
              </label>
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm">Retirada ativa</span>
                <input type="checkbox" checked={form.retirada_ativa} onChange={(e) => setForm({ ...form, retirada_ativa: e.target.checked })} />
              </label>
              <Field label="Tempo médio de preparo (min)">
                <input type="number" min={0} className={inputCls} value={form.tempo_preparo_min} onChange={(e) => setForm({ ...form, tempo_preparo_min: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Pedido mínimo (R$)">
                <input type="number" step="0.01" min={0} className={inputCls} value={form.pedido_minimo} onChange={(e) => setForm({ ...form, pedido_minimo: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Taxa de entrega (R$)">
                <input type="number" step="0.01" min={0} className={inputCls} value={form.taxa_entrega} onChange={(e) => setForm({ ...form, taxa_entrega: Number(e.target.value) || 0 })} />
              </Field>
            </div>
          </section>

          {/* Horários */}
          <section className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Horário de funcionamento</h2>
            <div className="space-y-2">
              {DIAS.map((d) => {
                const h = form.horarios[d.key];
                return (
                  <div key={d.key} className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-4 sm:col-span-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={h.ativo}
                        onChange={(e) =>
                          setForm({ ...form, horarios: { ...form.horarios, [d.key]: { ...h, ativo: e.target.checked } } })
                        }
                      />
                      <span className="text-sm">{d.label}</span>
                    </div>
                    <div className="col-span-4 sm:col-span-3">
                      <input
                        type="time"
                        className={inputCls}
                        disabled={!h.ativo}
                        value={h.abre}
                        onChange={(e) =>
                          setForm({ ...form, horarios: { ...form.horarios, [d.key]: { ...h, abre: e.target.value } } })
                        }
                      />
                    </div>
                    <span className="col-span-1 text-center text-xs text-muted-foreground">às</span>
                    <div className="col-span-3 sm:col-span-3">
                      <input
                        type="time"
                        className={inputCls}
                        disabled={!h.ativo}
                        value={h.fecha}
                        onChange={(e) =>
                          setForm({ ...form, horarios: { ...form.horarios, [d.key]: { ...h, fecha: e.target.value } } })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </button>
          </div>
        </>
      )}
    </div>
  );
}
