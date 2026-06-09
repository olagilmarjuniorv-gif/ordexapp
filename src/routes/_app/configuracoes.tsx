import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Settings as SettingsIcon, Download, AlertTriangle, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  getConfiguracoes, updateEmpresa, updateOperacao,
  updateWhatsappConfig, updateChatbot, createPrivacyRequest,
} from "@/lib/configuracoes.functions";
import { updateCompanyPagamentos, type HorariosFuncionamento } from "@/lib/companies.functions";
import { listMyCobrancas } from "@/lib/assinaturas.functions";
import { TrialBanner } from "@/components/TrialBanner";

export const Route = createFileRoute("/_app/configuracoes")({
  component: ConfiguracoesPage,
  head: () => ({ meta: [{ title: "Configurações — SaiuPedido" }] }),
});

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function SaveBar({ onSave, saving, disabled }: { onSave: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar
      </button>
    </div>
  );
}

const DIAS: { key: keyof HorariosFuncionamento; label: string }[] = [
  { key: "seg", label: "Segunda" }, { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" }, { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" }, { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

function ConfiguracoesPage() {
  const { isAdmin, isSuperAdmin, isAtendente, isCozinha, loading } = useAuth();
  const qc = useQueryClient();
  const getFn = useServerFn(getConfiguracoes);

  const initialTab = (() => {
    if (typeof window === "undefined") return "empresa";
    return new URLSearchParams(window.location.search).get("tab") || "empresa";
  })();
  const [tab, setTab] = useState<string>(initialTab);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== tab) {
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  }, [tab]);

  const { data, isLoading } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: () => getFn({ data: {} }),
    enabled: !loading && !isCozinha,
  });

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (isCozinha) return <Navigate to="/dashboard" />;
  if (!isAdmin && !isSuperAdmin && !isAtendente) return <Navigate to="/dashboard" />;

  const readOnly = isAtendente && !isAdmin && !isSuperAdmin;
  const company = (data?.company ?? null) as any;

  const refetch = () => qc.invalidateQueries({ queryKey: ["configuracoes"] });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Centro de configuração operacional do restaurante.
          </p>
        </div>
      </div>

      {isLoading || !data || !company ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
            <TabsTrigger value="operacao">Operação</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
            <TabsTrigger value="chatbot">Chatbot</TabsTrigger>
            <TabsTrigger value="privacidade">Privacidade</TabsTrigger>
          </TabsList>

          <TabsContent value="empresa">
            <AbaEmpresa company={company} readOnly={readOnly} onSaved={refetch} />
          </TabsContent>
          <TabsContent value="operacao">
            <AbaOperacao company={company} readOnly={readOnly} onSaved={refetch} />
          </TabsContent>
          <TabsContent value="whatsapp">
            <AbaWhatsapp company={company} conexao={data.conexao} readOnly={readOnly} onSaved={refetch} />
          </TabsContent>
          <TabsContent value="pagamentos">
            <AbaPagamentos company={company} readOnly={readOnly} onSaved={refetch} />
          </TabsContent>
          <TabsContent value="assinatura">
            <AbaAssinatura subscription={data.subscription} uso={data.uso} trial={(data as any).trial} />
          </TabsContent>
          <TabsContent value="chatbot">
            <AbaChatbot company={company} fluxo={data.fluxo} readOnly={readOnly} onSaved={refetch} />
          </TabsContent>
          <TabsContent value="privacidade">
            <AbaPrivacidade company={company} readOnly={readOnly} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============== ABA 1 — EMPRESA ==============
function ReqLabel({ label }: { label: string }) {
  return <span>{label} <span className="text-destructive">*</span></span>;
}

function AbaEmpresa({ company, readOnly, onSaved }: { company: any; readOnly: boolean; onSaved: () => void }) {
  const saveFn = useServerFn(updateEmpresa);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    id: company.id,
    name: company.name ?? "",
    razao_social: company.razao_social ?? "",
    cnpj: company.cnpj ?? "",
    inscricao_estadual: company.inscricao_estadual ?? "",
    phone: company.phone ?? "",
    email: company.email ?? "",
    email_financeiro: company.email_financeiro ?? "",
    email_operacional: company.email_operacional ?? "",
    responsavel_nome: company.responsavel_nome ?? "",
    responsavel_cpf: company.responsavel_cpf ?? "",
    responsavel_telefone: company.responsavel_telefone ?? "",
    cep: company.cep ?? "", rua: company.rua ?? "", numero: company.numero ?? "",
    complemento: company.complemento ?? "", bairro: company.bairro ?? "",
    cidade: company.cidade ?? "", estado: company.estado ?? "",
    nome_publico: company.nome_publico ?? "",
    telefone_publico: company.telefone_publico ?? "",
    endereco_publico: company.endereco_publico ?? "",
  });
  const upd = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    // validação amigável dos obrigatórios
    const faltam: string[] = [];
    if (!f.razao_social.trim()) faltam.push("Razão Social");
    if (!f.cnpj.trim()) faltam.push("CNPJ");
    if (!f.phone.trim()) faltam.push("Telefone Principal");
    if (!f.email.trim()) faltam.push("E-mail Principal");
    if (faltam.length) { toast.error(`Preencha: ${faltam.join(", ")}`); return; }

    setSaving(true);
    try {
      await saveFn({ data: f });
      toast.success("Empresa atualizada");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <Section title="Dados da empresa">
        <p className="text-xs text-muted-foreground -mt-2">
          Esses dados são necessários para emissão de cobranças e ativação da assinatura.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={<ReqLabel label="Razão Social" /> as any}><input className={inputCls} disabled={readOnly} value={f.razao_social} onChange={upd("razao_social")} /></Field>
          <Field label={<ReqLabel label="CNPJ" /> as any}><input className={inputCls} disabled={readOnly} value={f.cnpj} onChange={upd("cnpj")} placeholder="00.000.000/0000-00" /></Field>
          <Field label={<ReqLabel label="Telefone Principal" /> as any}><input className={inputCls} disabled={readOnly} value={f.phone} onChange={upd("phone")} /></Field>
          <Field label={<ReqLabel label="E-mail Principal" /> as any}><input className={inputCls} disabled={readOnly} value={f.email} onChange={upd("email")} /></Field>
        </div>
      </Section>

      <Section title="Responsável">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome"><input className={inputCls} disabled={readOnly} value={f.responsavel_nome} onChange={upd("responsavel_nome")} /></Field>
          <Field label="CPF"><input className={inputCls} disabled={readOnly} value={f.responsavel_cpf} onChange={upd("responsavel_cpf")} placeholder="000.000.000-00" /></Field>
          <Field label="Telefone"><input className={inputCls} disabled={readOnly} value={f.responsavel_telefone} onChange={upd("responsavel_telefone")} /></Field>
        </div>
      </Section>

      <Section title="Endereço">
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2"><Field label="CEP"><input className={inputCls} disabled={readOnly} value={f.cep} onChange={upd("cep")} /></Field></div>
          <div className="sm:col-span-3"><Field label="Rua"><input className={inputCls} disabled={readOnly} value={f.rua} onChange={upd("rua")} /></Field></div>
          <div className="sm:col-span-1"><Field label="Número"><input className={inputCls} disabled={readOnly} value={f.numero} onChange={upd("numero")} /></Field></div>
          <div className="sm:col-span-3"><Field label="Complemento"><input className={inputCls} disabled={readOnly} value={f.complemento} onChange={upd("complemento")} /></Field></div>
          <div className="sm:col-span-3"><Field label="Bairro"><input className={inputCls} disabled={readOnly} value={f.bairro} onChange={upd("bairro")} /></Field></div>
          <div className="sm:col-span-4"><Field label="Cidade"><input className={inputCls} disabled={readOnly} value={f.cidade} onChange={upd("cidade")} /></Field></div>
          <div className="sm:col-span-2"><Field label="Estado"><input className={inputCls} disabled={readOnly} value={f.estado} onChange={upd("estado")} /></Field></div>
        </div>
      </Section>

      <Section title="Informações públicas (exibidas ao cliente)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome exibido"><input className={inputCls} disabled={readOnly} value={f.nome_publico} onChange={upd("nome_publico")} /></Field>
          <Field label="Telefone exibido"><input className={inputCls} disabled={readOnly} value={f.telefone_publico} onChange={upd("telefone_publico")} /></Field>
          <div className="sm:col-span-2"><Field label="Endereço exibido"><input className={inputCls} disabled={readOnly} value={f.endereco_publico} onChange={upd("endereco_publico")} /></Field></div>
        </div>
      </Section>

      {!readOnly && <SaveBar onSave={save} saving={saving} />}
    </div>
  );
}

// ============== ABA 2 — OPERAÇÃO ==============
function AbaOperacao({ company, readOnly, onSaved }: { company: any; readOnly: boolean; onSaved: () => void }) {
  const saveFn = useServerFn(updateOperacao);
  const [saving, setSaving] = useState(false);
  const defaultCanais = { whatsapp: true, balcao: true, mesa: true, delivery: true, ifood: false };
  const defaultMsgs = { loja_fechada: "", recebido: "", preparo: "", pronto: "", finalizado: "" };
  const [f, setF] = useState({
    id: company.id,
    canais_ativos: { ...defaultCanais, ...(company.canais_ativos ?? {}) },
    delivery_ativo: !!company.delivery_ativo,
    retirada_ativa: !!company.retirada_ativa,
    horarios: company.horarios as HorariosFuncionamento,
    tempo_preparo_min: Number(company.tempo_preparo_min ?? 30),
    tempo_entrega_min: Number(company.tempo_entrega_min ?? 45),
    pedido_minimo: Number(company.pedido_minimo ?? 0),
    taxa_entrega: Number(company.taxa_entrega ?? 0),
    raio_entrega_km: Number(company.raio_entrega_km ?? 0),
    mensagens_operacionais: { ...defaultMsgs, ...(company.mensagens_operacionais ?? {}) },
  });

  const save = async () => {
    setSaving(true);
    try { await saveFn({ data: f }); toast.success("Operação atualizada"); onSaved(); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const canais: { key: keyof typeof defaultCanais; label: string }[] = [
    { key: "whatsapp", label: "WhatsApp" }, { key: "balcao", label: "Balcão" },
    { key: "mesa", label: "Mesa" }, { key: "delivery", label: "Delivery próprio" },
    { key: "ifood", label: "iFood" },
  ];

  return (
    <div className="space-y-5">
      <Section title="Canais habilitados">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {canais.map((c) => (
            <label key={c.key} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm">{c.label}</span>
              <input type="checkbox" disabled={readOnly}
                checked={!!f.canais_ativos[c.key]}
                onChange={(e) => setF({ ...f, canais_ativos: { ...f.canais_ativos, [c.key]: e.target.checked } })} />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Funcionamento">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">Aceita entrega</span>
            <input type="checkbox" disabled={readOnly} checked={f.delivery_ativo}
              onChange={(e) => setF({ ...f, delivery_ativo: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">Aceita retirada</span>
            <input type="checkbox" disabled={readOnly} checked={f.retirada_ativa}
              onChange={(e) => setF({ ...f, retirada_ativa: e.target.checked })} />
          </label>
        </div>
      </Section>

      <Section title="Horário de funcionamento">
        <div className="space-y-2">
          {DIAS.map((d) => {
            const h = f.horarios[d.key];
            return (
              <div key={d.key} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-4 sm:col-span-3 flex items-center gap-2">
                  <input type="checkbox" disabled={readOnly} checked={h.ativo}
                    onChange={(e) => setF({ ...f, horarios: { ...f.horarios, [d.key]: { ...h, ativo: e.target.checked } } })} />
                  <span className="text-sm">{d.label}</span>
                </div>
                <div className="col-span-4 sm:col-span-3">
                  <input type="time" className={inputCls} disabled={readOnly || !h.ativo} value={h.abre}
                    onChange={(e) => setF({ ...f, horarios: { ...f.horarios, [d.key]: { ...h, abre: e.target.value } } })} />
                </div>
                <span className="col-span-1 text-center text-xs text-muted-foreground">às</span>
                <div className="col-span-3 sm:col-span-3">
                  <input type="time" className={inputCls} disabled={readOnly || !h.ativo} value={h.fecha}
                    onChange={(e) => setF({ ...f, horarios: { ...f.horarios, [d.key]: { ...h, fecha: e.target.value } } })} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Entrega">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Field label="Tempo médio de preparo (min)">
            <input type="number" min={0} className={inputCls} disabled={readOnly} value={f.tempo_preparo_min}
              onChange={(e) => setF({ ...f, tempo_preparo_min: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Tempo médio de entrega (min)">
            <input type="number" min={0} className={inputCls} disabled={readOnly} value={f.tempo_entrega_min}
              onChange={(e) => setF({ ...f, tempo_entrega_min: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Raio máximo de entrega (km)">
            <input type="number" min={0} step="0.1" className={inputCls} disabled={readOnly} value={f.raio_entrega_km}
              onChange={(e) => setF({ ...f, raio_entrega_km: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Pedido mínimo (R$)">
            <input type="number" min={0} step="0.01" className={inputCls} disabled={readOnly} value={f.pedido_minimo}
              onChange={(e) => setF({ ...f, pedido_minimo: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Taxa de entrega (R$)">
            <input type="number" min={0} step="0.01" className={inputCls} disabled={readOnly} value={f.taxa_entrega}
              onChange={(e) => setF({ ...f, taxa_entrega: Number(e.target.value) || 0 })} />
          </Field>
        </div>
      </Section>

      <Section title="Mensagens operacionais">
        <p className="text-xs text-muted-foreground">Serão utilizadas em automações e WhatsApp.</p>
        <div className="grid gap-4">
          {([
            ["loja_fechada", "Loja fechada"],
            ["recebido", "Pedido recebido"],
            ["preparo", "Pedido em preparo"],
            ["pronto", "Pedido pronto"],
            ["finalizado", "Pedido finalizado"],
          ] as const).map(([k, lbl]) => (
            <Field key={k} label={lbl}>
              <textarea className={inputCls} rows={2} disabled={readOnly}
                value={(f.mensagens_operacionais as any)[k]}
                onChange={(e) => setF({ ...f, mensagens_operacionais: { ...f.mensagens_operacionais, [k]: e.target.value } })} />
            </Field>
          ))}
        </div>
      </Section>

      {!readOnly && <SaveBar onSave={save} saving={saving} />}
    </div>
  );
}

// ============== ABA 3 — WHATSAPP ==============
function AbaWhatsapp({ company, conexao, readOnly, onSaved }:
  { company: any; conexao: any; readOnly: boolean; onSaved: () => void }) {
  const saveFn = useServerFn(updateWhatsappConfig);
  const settings = (conexao?.settings ?? {}) as Record<string, any>;
  const [f, setF] = useState({
    bot_habilitado: !!settings.bot_habilitado,
    humano_habilitado: settings.humano_habilitado !== false,
    auto_status: !!settings.auto_status,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await saveFn({ data: { companyId: company.id, ...f } }); toast.success("WhatsApp atualizado"); onSaved(); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao salvar"); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-5">
      <Section title="Integração">
        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <div><span className="text-muted-foreground">Número:</span> {conexao?.phone_number ?? "—"}</div>
          <div><span className="text-muted-foreground">Phone Number ID:</span> {conexao?.phone_number_id ?? "—"}</div>
          <div><span className="text-muted-foreground">Status:</span> {conexao?.status ?? "desconectado"}</div>
          <div><span className="text-muted-foreground">Conectado em:</span> {conexao?.connected_at ? new Date(conexao.connected_at).toLocaleString("pt-BR") : "—"}</div>
          <div><span className="text-muted-foreground">Última sincronização:</span> {conexao?.last_sync_at ? new Date(conexao.last_sync_at).toLocaleString("pt-BR") : "—"}</div>
        </div>
      </Section>

      <Section title="Recursos">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">Bot habilitado</span>
            <input type="checkbox" disabled={readOnly} checked={f.bot_habilitado}
              onChange={(e) => setF({ ...f, bot_habilitado: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">Atendimento humano</span>
            <input type="checkbox" disabled={readOnly} checked={f.humano_habilitado}
              onChange={(e) => setF({ ...f, humano_habilitado: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">Atualizações automáticas de status</span>
            <input type="checkbox" disabled={readOnly} checked={f.auto_status}
              onChange={(e) => setF({ ...f, auto_status: e.target.checked })} />
          </label>
        </div>
      </Section>

      <Section title="Indicadores">
        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <div><span className="text-muted-foreground">Conversas no mês:</span> —</div>
          <div><span className="text-muted-foreground">Conversas disponíveis:</span> —</div>
          <div><span className="text-muted-foreground">Conversas excedentes:</span> —</div>
          <div><span className="text-muted-foreground">Qualidade do número:</span> —</div>
          <div><span className="text-muted-foreground">Status conta Meta:</span> —</div>
          <div><span className="text-muted-foreground">Health Score:</span> —</div>
        </div>
        <p className="text-xs text-muted-foreground">Indicadores Meta serão preenchidos quando a integração for ativada.</p>
      </Section>

      {!readOnly && <SaveBar onSave={save} saving={saving} />}
    </div>
  );
}

// ============== ABA 4 — PAGAMENTOS ==============
function AbaPagamentos({ company, readOnly, onSaved }: { company: any; readOnly: boolean; onSaved: () => void }) {
  const saveFn = useServerFn(updateCompanyPagamentos);
  const defaults = { pix_online: false, dinheiro: true, credito_presencial: true, debito_presencial: true,
    pix_presencial: true, pagamento_entrega: true, pagamento_retirada: true };
  const [f, setF] = useState({
    pagamento_metodos: { ...defaults, ...(company.pagamento_metodos ?? {}) },
    exigir_pagamento_antes_cozinha: !!company.exigir_pagamento_antes_cozinha,
    permitir_pagamento_entrega: company.permitir_pagamento_entrega !== false,
    permitir_pagamento_retirada: company.permitir_pagamento_retirada !== false,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await saveFn({ data: { id: company.id, ...f } }); toast.success("Pagamentos atualizados"); onSaved(); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao salvar"); }
    finally { setSaving(false); }
  };
  const metodos: { key: keyof typeof defaults; label: string }[] = [
    { key: "pix_online", label: "Pix online" }, { key: "dinheiro", label: "Dinheiro" },
    { key: "credito_presencial", label: "Cartão de crédito presencial" },
    { key: "debito_presencial", label: "Cartão de débito presencial" },
    { key: "pix_presencial", label: "Pix presencial" },
    { key: "pagamento_entrega", label: "Pagamento na entrega" },
    { key: "pagamento_retirada", label: "Pagamento na retirada" },
  ];
  return (
    <div className="space-y-5">
      <Section title="Métodos aceitos">
        <div className="grid gap-3 sm:grid-cols-2">
          {metodos.map((m) => (
            <label key={m.key} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm">{m.label}</span>
              <input type="checkbox" disabled={readOnly}
                checked={!!f.pagamento_metodos[m.key]}
                onChange={(e) => setF({ ...f, pagamento_metodos: { ...f.pagamento_metodos, [m.key]: e.target.checked } })} />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Regras de pagamento">
        <div className="grid gap-3">
          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">Exigir pagamento antes da cozinha</span>
            <input type="checkbox" disabled={readOnly} checked={f.exigir_pagamento_antes_cozinha}
              onChange={(e) => setF({ ...f, exigir_pagamento_antes_cozinha: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">Permitir pagamento na entrega</span>
            <input type="checkbox" disabled={readOnly} checked={f.permitir_pagamento_entrega}
              onChange={(e) => setF({ ...f, permitir_pagamento_entrega: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">Permitir pagamento na retirada</span>
            <input type="checkbox" disabled={readOnly} checked={f.permitir_pagamento_retirada}
              onChange={(e) => setF({ ...f, permitir_pagamento_retirada: e.target.checked })} />
          </label>
        </div>
      </Section>

      <Section title="Gateway de pagamento">
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          {["Asaas", "Mercado Pago", "Outros"].map((g) => (
            <div key={g} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-muted-foreground">
              {g} <span className="text-xs">(em breve)</span>
            </div>
          ))}
        </div>
      </Section>

      {!readOnly && <SaveBar onSave={save} saving={saving} />}
    </div>
  );
}

// ============== ABA 5 — ASSINATURA ==============
function AbaAssinatura({ subscription, uso, trial }: { subscription: any; uso: any; trial?: any }) {
  const s = subscription ?? { plano: "base", ciclo: "mensal", status: "trial", valor: 0,
    limite_pedidos_mes: 300, limite_conversas_mes: 300, limite_usuarios: 1,
    proxima_cobranca: null, inicio: null, vencimento: null };

  const fmtRest = (v: number | null | undefined) => v === null || v === undefined ? "Ilimitado" : String(v);
  const pct = (used: number, lim: number) => lim > 0 ? Math.min(100, Math.round((used / lim) * 100)) : 0;
  const items = useMemo(() => ([
    { key: "pedidos", label: "Pedidos", used: uso?.pedidos ?? 0, lim: s.limite_pedidos_mes },
    { key: "conversas", label: "Conversas WhatsApp", used: uso?.conversas ?? 0, lim: s.limite_conversas_mes },
    { key: "usuarios", label: "Usuários", used: uso?.usuarios ?? 0, lim: s.limite_usuarios },
  ]), [uso, s]);

  const fmtDate = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString("pt-BR") : "—";

  const statusBadgeClass = (st: string) => {
    switch (st) {
      case "ativo": return "bg-success/15 text-success";
      case "trial": return "bg-primary/10 text-primary";
      case "pendente": return "bg-warning/20 text-warning-foreground";
      case "inadimplente":
      case "expirado":
      case "cancelado": return "bg-destructive/15 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-5">
      <TrialBanner trial={trial} />

      <Section title="Plano atual">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-primary/10 px-3 py-1 text-sm font-semibold text-primary uppercase">{s.plano}</span>
          <span className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase ${statusBadgeClass(s.status)}`}>{s.status}</span>
          <span className="text-sm text-muted-foreground">Ciclo: {s.ciclo}</span>
        </div>
      </Section>

      <Section title="Indicadores de uso">
        <div className="space-y-4">
          {items.map((it) => {
            const ilimitado = !it.lim || it.lim <= 0;
            const p = ilimitado ? 0 : pct(it.used, it.lim);
            const color = p >= 100 ? "bg-destructive" : p >= 90 ? "bg-orange-500" : p >= 80 ? "bg-yellow-500" : "bg-primary";
            const restante = uso?.restantes?.[it.key];
            const excedente = uso?.excedentes?.[it.key] ?? 0;
            return (
              <div key={it.label}>
                <div className="flex items-center justify-between text-sm">
                  <span>{it.label}</span>
                  <span className="text-muted-foreground">
                    {it.used} / {ilimitado ? "∞" : it.lim} {ilimitado ? "" : `(${p}%)`} · Restante: {fmtRest(restante)}
                  </span>
                </div>
                {!ilimitado && (
                  <div className="mt-1 h-2 w-full rounded bg-muted overflow-hidden">
                    <div className={`h-full ${color}`} style={{ width: `${p}%` }} />
                  </div>
                )}
                {it.key === "usuarios" && excedente > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" /> Excedente de usuários: {excedente}
                  </div>
                )}
                {!ilimitado && p >= 80 && it.key !== "usuarios" && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-orange-600">
                    <AlertTriangle className="h-3 w-3" /> Atenção: {p}% do limite atingido.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Financeiro">
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div><span className="text-muted-foreground">Início:</span> {fmtDate(s.inicio)}</div>
          <div><span className="text-muted-foreground">Vencimento:</span> {fmtDate(s.vencimento)}</div>
          <div><span className="text-muted-foreground">Próxima cobrança:</span> {fmtDate(s.proxima_cobranca)}</div>
          <div><span className="text-muted-foreground">Valor do plano:</span> R$ {Number(s.valor ?? 0).toFixed(2)}</div>
          <div><span className="text-muted-foreground">Ciclo:</span> {s.ciclo}</div>
          <div><span className="text-muted-foreground">Status:</span> {s.status}</div>
        </div>
      </Section>
    </div>
  );
}


// ============== ABA 6 — CHATBOT ==============
function AbaChatbot({ company, fluxo, readOnly, onSaved }: { company: any; fluxo: any; readOnly: boolean; onSaved: () => void }) {
  const saveFn = useServerFn(updateChatbot);
  const [f, setF] = useState({
    ativo: fluxo?.ativo ?? true,
    mensagem_boas_vindas: fluxo?.mensagem_boas_vindas ?? "Olá! Seja bem-vindo. Digite *menu* para ver nosso cardápio.",
    mensagem_fechamento: fluxo?.mensagem_fechamento ?? "Obrigado pelo seu pedido! Volte sempre.",
    mensagem_sem_atendimento: fluxo?.mensagem_sem_atendimento ?? "No momento nenhum atendente está disponível. Em breve responderemos.",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await saveFn({ data: { companyId: company.id, ...f } }); toast.success("Chatbot atualizado"); onSaved(); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao salvar"); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-5">
      <Section title="Configurações do chatbot">
        <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <span className="text-sm">Chatbot ativo</span>
          <input type="checkbox" disabled={readOnly} checked={f.ativo}
            onChange={(e) => setF({ ...f, ativo: e.target.checked })} />
        </label>
        <Field label="Saudação inicial">
          <textarea className={inputCls} rows={3} disabled={readOnly}
            value={f.mensagem_boas_vindas} onChange={(e) => setF({ ...f, mensagem_boas_vindas: e.target.value })} />
        </Field>
        <Field label="Mensagem de encerramento">
          <textarea className={inputCls} rows={2} disabled={readOnly}
            value={f.mensagem_fechamento} onChange={(e) => setF({ ...f, mensagem_fechamento: e.target.value })} />
        </Field>
        <Field label="Transferência ao atendimento humano">
          <textarea className={inputCls} rows={2} disabled={readOnly}
            value={f.mensagem_sem_atendimento} onChange={(e) => setF({ ...f, mensagem_sem_atendimento: e.target.value })} />
        </Field>
      </Section>

      <Section title="Fluxos avançados">
        <p className="text-sm text-muted-foreground">
          Respostas automáticas, fluxos personalizados e inteligência artificial serão disponibilizados em breve.
        </p>
      </Section>

      {!readOnly && <SaveBar onSave={save} saving={saving} />}
    </div>
  );
}

// ============== ABA 7 — PRIVACIDADE ==============
function AbaPrivacidade({ company, readOnly }: { company: any; readOnly: boolean }) {
  const fn = useServerFn(createPrivacyRequest);
  const [loading, setLoading] = useState<"exportacao" | "encerramento" | null>(null);
  const req = async (tipo: "exportacao" | "encerramento") => {
    if (readOnly) return;
    setLoading(tipo);
    try {
      await fn({ data: { companyId: company.id, tipo } });
      toast.success(tipo === "exportacao" ? "Solicitação de exportação registrada" : "Solicitação de encerramento registrada");
    } catch (e: any) { toast.error(e?.message ?? "Erro ao solicitar"); }
    finally { setLoading(null); }
  };
  return (
    <div className="space-y-5">
      <Section title="Documentos">
        <div className="grid gap-2 text-sm">
          <a href="/termos" className="text-primary hover:underline">Termos de Uso</a>
          <a href="/privacidade" className="text-primary hover:underline">Política de Privacidade</a>
          <a href="/cookies" className="text-primary hover:underline">Política de Cookies</a>
        </div>
      </Section>

      <Section title="Solicitações">
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => req("exportacao")} disabled={readOnly || loading !== null}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted disabled:opacity-60">
            {loading === "exportacao" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Solicitar exportação dos dados
          </button>
          <button onClick={() => req("encerramento")} disabled={readOnly || loading !== null}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60">
            {loading === "encerramento" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Solicitar encerramento da conta
          </button>
        </div>
      </Section>

      <Section title="Importante">
        <p className="text-sm text-muted-foreground">
          Após o cancelamento, os dados permanecerão armazenados por até 60 dias.
          Durante esse período será possível solicitar exportação ou reativação da conta.
        </p>
      </Section>
    </div>
  );
}
