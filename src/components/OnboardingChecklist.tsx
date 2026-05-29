import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Store,
  BookOpen,
  Wallet,
  MessageCircle,
  ShoppingBag,
  ChevronRight,
  Sparkles,
  X,
  Rocket,
} from "lucide-react";
import {
  getOnboardingStatus,
  type OnboardingItemKey,
} from "@/lib/onboarding.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";

const ITEMS: {
  key: OnboardingItemKey;
  title: string;
  desc: string;
  to: string;
  icon: any;
}[] = [
  {
    key: "meu_restaurante",
    title: "Meu Restaurante",
    desc: "Informe nome e telefone do estabelecimento.",
    to: "/meu-restaurante",
    icon: Store,
  },
  {
    key: "cardapio",
    title: "Cardápio",
    desc: "Cadastre ao menos 1 categoria e 1 produto ativo.",
    to: "/cardapio",
    icon: BookOpen,
  },
  {
    key: "pagamentos",
    title: "Pagamentos",
    desc: "Ative ao menos uma forma de pagamento.",
    to: "/pagamentos",
    icon: Wallet,
  },
  {
    key: "whatsapp",
    title: "WhatsApp",
    desc: "Conecte um número para receber pedidos.",
    to: "/conectores",
    icon: MessageCircle,
  },
  {
    key: "pedido_teste",
    title: "Pedido Teste",
    desc: "Crie um pedido (balcão, mesa ou delivery).",
    to: "/pedidos/novo",
    icon: ShoppingBag,
  },
];

function dismissKey(companyId: string | null) {
  return `saiupedido.onboarding.dismissed:${companyId ?? "none"}`;
}

export function OnboardingChecklist() {
  const getFn = useServerFn(getOnboardingStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => getFn({}),
    staleTime: 10_000,
  });

  // Recalcula quando dados-fonte mudam em tempo real
  useRealtimeInvalidate("pedidos", [["onboarding-status"]]);
  useRealtimeInvalidate("produtos", [["onboarding-status"]]);

  const [dismissed, setDismissed] = useState<boolean>(false);
  const [forceOpen, setForceOpen] = useState<boolean>(false);

  // Carrega estado dismissed do localStorage assim que tivermos companyId
  useEffect(() => {
    if (!data?.companyId) return;
    try {
      const v = localStorage.getItem(dismissKey(data.companyId));
      setDismissed(v === "1");
    } catch {}
  }, [data?.companyId]);

  if (isLoading || !data || !data.companyId) return null;

  const { items, completed, total, percent, done } = data;

  // Quando 100%, oculta por padrão — usuário pode reabrir
  const hiddenByCompletion = done && !forceOpen;
  const hiddenByUser = dismissed && !forceOpen;
  if (hiddenByCompletion || hiddenByUser) {
    return (
      <button
        type="button"
        onClick={() => setForceOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Configuração inicial · {percent}%
      </button>
    );
  }

  function dismiss() {
    if (!data?.companyId) return;
    try {
      localStorage.setItem(dismissKey(data.companyId), "1");
    } catch {}
    setDismissed(true);
    setForceOpen(false);
  }

  return (
    <section className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <header className="flex items-start justify-between gap-3 p-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Rocket className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold leading-tight">
              Configuração Inicial
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {done
                ? "Seu restaurante está pronto para operar."
                : `${completed} de ${total} concluídos · faltam ${total - completed}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          title="Ocultar"
          className="shrink-0 p-1 -mr-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Barra de progresso */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium tabular-nums">{percent}%</span>
          <span className="text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ul className="divide-y divide-border">
        {ITEMS.map((it) => {
          const ok = items[it.key];
          const Icon = it.icon;
          return (
            <li key={it.key} className="flex items-center gap-3 p-3.5">
              <span className="shrink-0">
                {ok ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/50" />
                )}
              </span>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  ok
                    ? "bg-success/10 text-success"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium leading-tight ${
                    ok ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {it.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {it.desc}
                </p>
              </div>
              {ok ? (
                <span className="text-[11px] font-semibold uppercase text-success shrink-0">
                  Pronto
                </span>
              ) : (
                <Link
                  to={it.to}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
                >
                  Configurar
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {done && (
        <div className="p-4 border-t border-border bg-success/5 text-sm text-success font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Tudo certo! Você pode ocultar este painel.
        </div>
      )}
    </section>
  );
}
