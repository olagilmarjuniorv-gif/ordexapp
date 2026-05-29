import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  getCompanyById,
  updateCompanyPagamentos,
  listCompanies,
  PAGAMENTO_METODOS,
  type PagamentoMetodo,
  type PagamentoMetodosConfig,
} from "@/lib/companies.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/pagamentos")({
  component: PagamentosPage,
  head: () => ({ meta: [{ title: "Pagamentos — SaiuPedido" }] }),
});

const METODO_LABEL: Record<PagamentoMetodo, string> = {
  pix_online: "Pix online",
  dinheiro: "Dinheiro",
  credito_presencial: "Crédito presencial",
  debito_presencial: "Débito presencial",
  pix_presencial: "Pix presencial",
  pagamento_entrega: "Pagamento na entrega",
  pagamento_retirada: "Pagamento na retirada",
};

const METODO_DESC: Record<PagamentoMetodo, string> = {
  pix_online: "Cliente paga online via Pix (integração futura).",
  dinheiro: "Pagamento em dinheiro presencial.",
  credito_presencial: "Cartão de crédito na maquininha.",
  debito_presencial: "Cartão de débito na maquininha.",
  pix_presencial: "Pix na hora, presencial.",
  pagamento_entrega: "Cliente paga ao entregador.",
  pagamento_retirada: "Cliente paga ao retirar o pedido.",
};

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40";

function PagamentosPage() {
  const { isAdmin, isSuperAdmin, companyId, loading } = useAuth();
  const queryClient = useQueryClient();
  const getCompanyByIdFn = useServerFn(getCompanyById);
  const listCompaniesFn = useServerFn(listCompanies);
  const updateFn = useServerFn(updateCompanyPagamentos);

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

  const [metodos, setMetodos] = useState<PagamentoMetodosConfig | null>(null);
  const [exigirPgto, setExigirPgto] = useState(false);
  const [permEntrega, setPermEntrega] = useState(true);
  const [permRetirada, setPermRetirada] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company) return;
    const c = company as any;
    setMetodos((c.pagamento_metodos ?? {
      pix_online: false, dinheiro: true, credito_presencial: true,
      debito_presencial: true, pix_presencial: true,
      pagamento_entrega: true, pagamento_retirada: true,
    }) as PagamentoMetodosConfig);
    setExigirPgto(!!c.exigir_pagamento_antes_cozinha);
    setPermEntrega(c.permitir_pagamento_entrega ?? true);
    setPermRetirada(c.permitir_pagamento_retirada ?? true);
  }, [company]);

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (!isAdmin && !isSuperAdmin) return <Navigate to="/dashboard" />;

  const save = async () => {
    if (!metodos || !effectiveId) return;
    setSaving(true);
    try {
      await updateFn({
        data: {
          id: effectiveId,
          pagamento_metodos: metodos,
          exigir_pagamento_antes_cozinha: exigirPgto,
          permitir_pagamento_entrega: permEntrega,
          permitir_pagamento_retirada: permRetirada,
        },
      });
      toast.success("Configurações de pagamento salvas");
      queryClient.invalidateQueries({ queryKey: ["company"] });
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
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Pagamentos</h1>
          <p className="text-sm text-muted-foreground">
            Defina as formas de pagamento aceitas e as regras operacionais do seu restaurante.
          </p>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="rounded-lg border border-border bg-card p-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Empresa (super admin)</span>
            <select
              className={inputCls + " mt-1"}
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {(companiesList.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {isLoading || !metodos ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Formas de pagamento aceitas</h2>
            <p className="text-xs text-muted-foreground">
              Apenas os métodos ativados ficam disponíveis para atendentes e para o cliente final.
              <strong className="ml-1">Pix online</strong> ainda não está integrado a um gateway.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PAGAMENTO_METODOS.map((m) => (
                <label
                  key={m}
                  className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={metodos[m]}
                    onChange={(e) => setMetodos({ ...metodos, [m]: e.target.checked })}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{METODO_LABEL[m]}</div>
                    <div className="text-xs text-muted-foreground">{METODO_DESC[m]}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Regras operacionais</h2>
            <div className="space-y-2">
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium">Exigir pagamento antes de enviar para cozinha</div>
                  <div className="text-xs text-muted-foreground">
                    Pedido só é enviado ao preparo após o financeiro confirmar pagamento.
                  </div>
                </div>
                <input type="checkbox" checked={exigirPgto} onChange={(e) => setExigirPgto(e.target.checked)} />
              </label>
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium">Permitir pagamento na entrega</div>
                  <div className="text-xs text-muted-foreground">Cliente pode pagar ao receber o pedido.</div>
                </div>
                <input type="checkbox" checked={permEntrega} onChange={(e) => setPermEntrega(e.target.checked)} />
              </label>
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium">Permitir pagamento na retirada</div>
                  <div className="text-xs text-muted-foreground">Cliente pode pagar ao retirar o pedido.</div>
                </div>
                <input type="checkbox" checked={permRetirada} onChange={(e) => setPermRetirada(e.target.checked)} />
              </label>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configurações
            </button>
          </div>
        </>
      )}
    </div>
  );
}
