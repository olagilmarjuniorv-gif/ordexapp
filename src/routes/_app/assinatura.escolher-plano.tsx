import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  createSubscriptionIntent,
  getMySubscriptionIntent,
} from "@/lib/subscription-intents.functions";
import { checkBillingReadiness } from "@/lib/asaas.functions";
import {
  createPixForIntent,
  getSubscriptionPaymentStatus,
  type PixPaymentDTO,
} from "@/lib/pix.functions";
import { getMyPendingCobranca } from "@/lib/assinaturas.functions";

const BILLING_LABELS: Record<string, string> = {
  cpf_cnpj: "CNPJ ou CPF do responsável",
  nome: "Razão social / Nome da empresa",
  email: "E-mail",
  telefone: "Telefone / WhatsApp",
};

export const Route = createFileRoute("/_app/assinatura/escolher-plano")({
  component: EscolherPlanoPage,
});

type PlanoId = "base" | "pro" | "max";
type Ciclo = "mensal" | "anual";

type PlanoDef = {
  id: PlanoId;
  nome: string;
  resumo: string;
  pedidos: string;
  conversas: string;
  usuarios: string;
  destaque?: boolean;
};

const PLANOS: PlanoDef[] = [
  { id: "base", nome: "Base", resumo: "Para começar com o essencial.", pedidos: "300 pedidos/mês", conversas: "300 conversas WhatsApp/mês", usuarios: "1 usuário" },
  { id: "pro", nome: "Pro", resumo: "Para restaurantes em crescimento.", pedidos: "1.500 pedidos/mês", conversas: "1.500 conversas WhatsApp/mês", usuarios: "3 usuários", destaque: true },
  { id: "max", nome: "Max", resumo: "Para operações de alto volume.", pedidos: "Pedidos ilimitados", conversas: "3.000 conversas WhatsApp/mês", usuarios: "8 usuários" },
];

type Step = 1 | 2 | 3 | 4 | 5;

function EscolherPlanoPage() {
  const { isAdmin, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [plano, setPlano] = useState<PlanoId | null>(null);
  const [ciclo, setCiclo] = useState<Ciclo>("mensal");
  const [pix, setPix] = useState<PixPaymentDTO | null>(null);

  const createFn = useServerFn(createSubscriptionIntent);
  const getIntentFn = useServerFn(getMySubscriptionIntent);
  const checkBillingFn = useServerFn(checkBillingReadiness);
  const createPixFn = useServerFn(createPixForIntent);
  const getPendingCobFn = useServerFn(getMyPendingCobranca);

  const intentQuery = useQuery({
    queryKey: ["my-subscription-intent"],
    queryFn: () => getIntentFn(),
    enabled: isAdmin && !isSuperAdmin,
  });

  const billingQuery = useQuery({
    queryKey: ["billing-readiness"],
    queryFn: () => checkBillingFn(),
    enabled: isAdmin && !isSuperAdmin,
  });

  const pendingCobQuery = useQuery({
    queryKey: ["my-pending-cobranca"],
    queryFn: () => getPendingCobFn(),
    enabled: isAdmin && !isSuperAdmin,
  });

  const mutation = useMutation({
    mutationFn: async (input: { plano: PlanoId; ciclo: Ciclo }) => {
      const intent = await createFn({ data: input });
      const pixData = await createPixFn({ data: { intentId: (intent as any).id } });
      return pixData;
    },
    onSuccess: (data) => {
      setPix(data);
      setStep(4);
      qc.invalidateQueries({ queryKey: ["my-subscription-intent"] });
    },
    onError: (e: any) => {
      const msg =
        typeof e?.message === "string" && e.message.trim()
          ? e.message
          : "Erro ao iniciar pagamento";
      toast.error(msg);
    },
  });

  if (loading) return null;
  if (!isAdmin || isSuperAdmin) return <Navigate to="/dashboard" />;

  const planoEscolhido = plano ? PLANOS.find((p) => p.id === plano)! : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Escolher um plano</h1>
          {intentQuery.data ? (
            <Badge variant="outline" className="capitalize">
              Última escolha: {(intentQuery.data as any).plano} · {(intentQuery.data as any).ciclo}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Compare os planos e selecione o que faz mais sentido para o seu restaurante.
        </p>
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <Step1 plano={plano} onSelect={(p) => setPlano(p)} onNext={() => plano && setStep(2)} />
      )}

      {step === 2 && (
        <Step2 ciclo={ciclo} onChange={setCiclo} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}

      {step === 3 && planoEscolhido && (
        <Step3
          plano={planoEscolhido}
          ciclo={ciclo}
          onBack={() => setStep(2)}
          onConfirm={() => {
            if (billingQuery.data && !billingQuery.data.ok) {
              toast.error("Complete os dados fiscais da empresa antes de continuar.");
              return;
            }
            mutation.mutate({ plano: planoEscolhido.id, ciclo });
          }}
          saving={mutation.isPending}
          billingMissing={billingQuery.data && !billingQuery.data.ok ? billingQuery.data.missing : null}
          onGoToConfig={() => navigate({ to: "/configuracoes" })}
        />
      )}

      {step === 4 && pix && (
        <Step4Pix
          pix={pix}
          onPaid={() => setStep(5)}
          onCancel={() => {
            setPix(null);
            setStep(3);
          }}
        />
      )}

      {step === 5 && (
        <Step5Sucesso onGo={() => navigate({ to: "/dashboard" })} />
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Plano" },
    { n: 2, label: "Ciclo" },
    { n: 3, label: "Resumo" },
    { n: 4, label: "Pagamento" },
  ];
  return (
    <ol className="flex items-center gap-2 text-sm flex-wrap">
      {items.map((it, idx) => {
        const active = step === it.n;
        const done = step > it.n;
        return (
          <li key={it.n} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium",
                active && "bg-primary text-primary-foreground border-primary",
                done && "bg-primary/10 text-primary border-primary/30",
                !active && !done && "text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : it.n}
            </span>
            <span className={cn(active || done ? "text-foreground font-medium" : "text-muted-foreground")}>
              {it.label}
            </span>
            {idx < items.length - 1 && <span className="mx-2 h-px w-8 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function Step1({ plano, onSelect, onNext }: { plano: PlanoId | null; onSelect: (p: PlanoId) => void; onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {PLANOS.map((p) => {
          const selected = plano === p.id;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={cn(
                "relative text-left rounded-xl border bg-card p-5 flex flex-col gap-3 transition-all",
                "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40",
                selected ? "border-primary ring-2 ring-primary/30" : "border-border",
              )}
            >
              {p.destaque && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Mais popular
                </Badge>
              )}
              <div>
                <h3 className="text-xl font-semibold">{p.nome}</h3>
                <p className="text-xs text-muted-foreground mt-1">{p.resumo}</p>
              </div>
              <ul className="text-sm space-y-1.5 text-muted-foreground">
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> {p.pedidos}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> {p.conversas}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> {p.usuarios}</li>
              </ul>
              {selected && (
                <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Check className="h-4 w-4" /> Selecionado
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!plano}>Continuar</Button>
      </div>
    </div>
  );
}

function Step2({ ciclo, onChange, onBack, onNext }: { ciclo: Ciclo; onChange: (c: Ciclo) => void; onBack: () => void; onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <CicloCard id="mensal" titulo="Mensal" descricao="Cobrança todo mês. Cancele quando quiser." selected={ciclo === "mensal"} onSelect={() => onChange("mensal")} />
        <CicloCard id="anual" titulo="Anual" descricao="Pague uma vez por ano e economize." selected={ciclo === "anual"} onSelect={() => onChange("anual")} badge="Economize no anual" />
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Button onClick={onNext}>Continuar</Button>
      </div>
    </div>
  );
}

function CicloCard({ titulo, descricao, selected, onSelect, badge }: { id: Ciclo; titulo: string; descricao: string; selected: boolean; onSelect: () => void; badge?: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative text-left rounded-xl border bg-card p-5 transition-all",
        "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
    >
      {badge && (
        <Badge className="absolute -top-2 left-4 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
          {badge}
        </Badge>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{titulo}</h3>
        {selected && <Check className="h-5 w-5 text-primary" />}
      </div>
      <p className="text-sm text-muted-foreground mt-1">{descricao}</p>
    </button>
  );
}

function Step3({
  plano, ciclo, onBack, onConfirm, saving, billingMissing, onGoToConfig,
}: {
  plano: PlanoDef;
  ciclo: Ciclo;
  onBack: () => void;
  onConfirm: () => void;
  saving: boolean;
  billingMissing: string[] | null;
  onGoToConfig: () => void;
}) {
  const blocked = !!billingMissing && billingMissing.length > 0;
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Resumo</p>
            <h3 className="text-2xl font-bold mt-1">Plano {plano.nome}</h3>
            <p className="text-sm text-muted-foreground">{plano.resumo}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ResumoItem label="Ciclo" value={ciclo === "anual" ? "Anual" : "Mensal"} />
            <ResumoItem label="Forma de pagamento" value="PIX" />
            <ResumoItem label="Limite de pedidos" value={plano.pedidos} />
            <ResumoItem label="Conversas WhatsApp" value={plano.conversas} />
            <ResumoItem label="Usuários" value={plano.usuarios} />
          </div>

          {blocked ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Complete os dados fiscais da empresa antes de continuar com a assinatura.
                  </p>
                  <ul className="mt-1 list-disc list-inside text-xs text-amber-900/80 dark:text-amber-200/80">
                    {billingMissing!.map((m) => (
                      <li key={m}>{BILLING_LABELS[m] ?? m}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={onGoToConfig}>
                Ir para Configurações → Empresa
              </Button>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Ao continuar geramos uma cobrança PIX (ambiente Sandbox) e exibimos o QR Code
              para pagamento. Sua assinatura é ativada automaticamente assim que o pagamento
              for confirmado.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Button onClick={onConfirm} disabled={saving || blocked}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
        </Button>
      </div>
    </div>
  );
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Step4Pix({ pix, onPaid, onCancel }: { pix: PixPaymentDTO; onPaid: () => void; onCancel: () => void }) {
  const getStatusFn = useServerFn(getSubscriptionPaymentStatus);

  const statusQuery = useQuery({
    queryKey: ["payment-status", pix.intent_id],
    queryFn: () => getStatusFn({ data: { intentId: pix.intent_id } }),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "pago" || s === "cancelado" || s === "expirado") return false;
      return 10_000;
    },
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (statusQuery.data?.status === "pago") onPaid();
  }, [statusQuery.data?.status, onPaid]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pix.qr_code_payload);
      toast.success("Código PIX copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pagamento PIX</p>
            <h3 className="text-2xl font-bold mt-1">Plano {pix.plano.toUpperCase()}</h3>
            <p className="text-sm text-muted-foreground capitalize">Ciclo: {pix.ciclo}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ResumoItem label="Valor" value={formatBRL(pix.valor)} />
            <ResumoItem label="Vencimento" value={new Date(pix.vencimento + "T00:00:00").toLocaleDateString("pt-BR")} />
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground mb-1">Código copia-e-cola</p>
            <p className="text-xs font-mono break-all leading-relaxed">{pix.qr_code_payload}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={copy}>
              <Copy className="h-4 w-4 mr-1" /> Copiar código PIX
            </Button>
          </div>
          {pix.invoice_url && (
            <a
              href={pix.invoice_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline"
            >
              Abrir fatura no Asaas
            </a>
          )}
          <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Aguardando confirmação do pagamento…</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Voltar e escolher outro plano
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center space-y-3">
          <p className="text-sm font-medium">Aponte a câmera do seu app bancário</p>
          <img
            src={`data:image/png;base64,${pix.qr_code_image}`}
            alt="QR Code PIX"
            className="h-64 w-64 rounded-md border bg-white p-2"
          />
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            A assinatura é ativada automaticamente assim que o Asaas confirmar o pagamento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Step5Sucesso({ onGo }: { onGo: () => void }) {
  return (
    <Card>
      <CardContent className="p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-2xl font-bold">Pagamento confirmado com sucesso</h3>
          <p className="text-sm text-muted-foreground mt-1">Seu plano foi ativado.</p>
        </div>
        <Button onClick={onGo}>Ir para Dashboard</Button>
      </CardContent>
    </Card>
  );
}

function ResumoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}
