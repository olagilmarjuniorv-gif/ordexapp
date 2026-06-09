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
import { getOnboardingStatus } from "@/lib/onboarding.functions";
import type { OnboardingItemKey } from "@/lib/onboarding.types";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";

const ITEMS: {
  key: OnboardingItemKey;
  title: string;
  desc: string;
  to: string;
  icon: any;
  cta: string;
  nextActionTitle: string;
  nextActionDesc: string;
}[] = [
  {
    key: "meu_restaurante",
    title: "Meu Restaurante",
    desc: "Informe nome, telefone e e-mail do estabelecimento.",
    to: "/configuracoes",
    icon: Store,
    cta: "Completar dados",
    nextActionTitle: "Complete os dados do seu restaurante",
    nextActionDesc: "Nome, telefone e e-mail são essenciais para começar a operar.",
  },
  {
    key: "cardapio",
    title: "Cardápio",
    desc: "Cadastre ao menos 1 categoria e 1 produto ativo.",
    to: "/cardapio",
    icon: BookOpen,
    cta: "Cadastrar produtos",
    nextActionTitle: "Cadastre seus primeiros produtos",
    nextActionDesc: "Sem cardápio, você não consegue receber pedidos.",
  },
  {
    key: "pagamentos",
    title: "Pagamentos",
    desc: "Ative ao menos uma forma de pagamento.",
    to: "/pagamentos",
    icon: Wallet,
    cta: "Configurar pagamento",
    nextActionTitle: "Configure uma forma de pagamento",
    nextActionDesc: "Defina como seus clientes vão pagar (PIX, cartão, dinheiro).",
  },
  {
    key: "whatsapp",
    title: "WhatsApp",
    desc: "Conecte um número para receber pedidos.",
    to: "/conectores",
    icon: MessageCircle,
    cta: "Conectar agora",
    nextActionTitle: "Conecte seu WhatsApp para começar a receber pedidos",
    nextActionDesc: "Centralize conversas e pedidos em um único painel.",
  },
  {
    key: "pedido_teste",
    title: "Pedido Teste",
    desc: "Crie um pedido (balcão, mesa ou delivery).",
    to: "/pedidos/novo",
    icon: ShoppingBag,
    cta: "Criar pedido teste",
    nextActionTitle: "Realize seu primeiro pedido teste",
    nextActionDesc: "Valide o fluxo completo antes de operar com clientes reais.",
  },
];


function dismissKey(companyId: string | null) {
  return `saiupedido.onboarding.dismissed:${companyId ?? "none"}`;
}

export function OnboardingChecklist() {
  console.log("[OC] 1 component render start");
  const getFn = useServerFn(getOnboardingStatus);
  const { data, isLoading, error } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: async () => {
      console.log("[OC] 2 queryFn called");
      try {
        const r = await getFn();
        console.log("[OC] 3 queryFn resolved", r);
        return r;
      } catch (e) {
        console.error("[OC] 3X queryFn threw", e);
        throw e;
      }
    },
    staleTime: 10_000,
  });
  console.log("[OC] 4 query state", { isLoading, hasData: !!data, error });

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

  if (error) {
    console.error("[OC] 5E render error branch", error);
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        Onboarding falhou: {(error as Error)?.message ?? String(error)}
      </div>
    );
  }
  if (isLoading || !data || !data.companyId) {
    console.log("[OC] 5 render guard (loading or no data)", { isLoading, data });
    return null;
  }

  const { items, completed, total, percent, done } = data;
  console.log("[OC] 6 derived progress", { items, completed, total, percent, done });


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

  const nextItem = ITEMS.find((i) => !items[i.key]);

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
                : `Seu restaurante está ${percent}% configurado · faltam ${total - completed}`}
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

      {/* Próxima ação recomendada */}
      {nextItem && (
        <div className="px-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3.5">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Próxima ação
                </p>
                <p className="text-sm font-semibold leading-tight mt-0.5">
                  {nextItem.nextActionTitle}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {nextItem.nextActionDesc}
                </p>
              </div>
            </div>
            <Link
              to={nextItem.to}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110 whitespace-nowrap"
            >
              {nextItem.cta}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

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
