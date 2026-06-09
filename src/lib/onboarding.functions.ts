import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

type OnboardingStatus = {
  companyId: string | null;
  items: {
    meu_restaurante: boolean;
    cardapio: boolean;
    pagamentos: boolean;
    whatsapp: boolean;
    pedido_teste: boolean;
  };
  completed: number;
  total: 5;
  percent: number;
  done: boolean;
};

function buildStatus(
  companyId: string | null,
  partial: Partial<OnboardingStatus["items"]> = {},
): OnboardingStatus {
  const items = {
    meu_restaurante: !!partial.meu_restaurante,
    cardapio: !!partial.cardapio,
    pagamentos: !!partial.pagamentos,
    whatsapp: !!partial.whatsapp,
    pedido_teste: !!partial.pedido_teste,
  };
  const total = 5 as const;
  const completed = Object.values(items).filter(Boolean).length;
  const percent = Math.round((completed / total) * 100);
  return {
    companyId,
    items,
    completed,
    total,
    percent,
    done: completed === total,
  };
}

function safeStr(v: unknown): string {
  if (v == null) return "";
  try {
    return String(v).trim();
  } catch {
    return "";
  }
}

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingStatus> => {
    try {
      const caller = await getCaller(context.userId).catch(() => null);
      const companyId =
        caller && typeof (caller as any).companyId === "string"
          ? ((caller as any).companyId as string)
          : null;

      if (!companyId) return buildStatus(null);

      // Company
      let meu_restaurante = false;
      let pagamentos = false;
      try {
        const companyRes = await supabaseAdmin
          .from("companies")
          .select("name, phone, email, pagamento_metodos")
          .eq("id", companyId)
          .maybeSingle();
        const company: any = companyRes?.data ?? null;
        meu_restaurante =
          !!safeStr(company?.name) &&
          !!safeStr(company?.phone) &&
          !!safeStr(company?.email);
        const metodos =
          company && typeof company.pagamento_metodos === "object" && company.pagamento_metodos
            ? (company.pagamento_metodos as Record<string, unknown>)
            : {};
        pagamentos = Object.values(metodos).some((v) => v === true);
      } catch {}

      // Categorias + produtos
      let cardapio = false;
      try {
        const [catRes, prodRes] = await Promise.all([
          supabaseAdmin
            .from("categorias")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("active", true),
          supabaseAdmin
            .from("produtos")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("active", true),
        ]);
        cardapio = (catRes?.count ?? 0) > 0 && (prodRes?.count ?? 0) > 0;
      } catch {}

      // WhatsApp
      let whatsapp = false;
      try {
        const waRes = await supabaseAdmin
          .from("whatsapp_conexoes")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("active", true)
          .eq("status", "conectado");
        whatsapp = (waRes?.count ?? 0) > 0;
      } catch {}

      // Pedidos
      let pedido_teste = false;
      try {
        const pedRes = await supabaseAdmin
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId);
        pedido_teste = (pedRes?.count ?? 0) > 0;
      } catch {}

      return buildStatus(companyId, {
        meu_restaurante,
        cardapio,
        pagamentos,
        whatsapp,
        pedido_teste,
      });
    } catch {
      return buildStatus(null);
    }
  });
