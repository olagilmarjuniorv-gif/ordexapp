import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

export type OnboardingItemKey =
  | "meu_restaurante"
  | "cardapio"
  | "pagamentos"
  | "whatsapp"
  | "pedido_teste";

export type OnboardingStatus = {
  companyId: string | null;
  items: Record<OnboardingItemKey, boolean>;
  completed: number;
  total: number;
  percent: number;
  done: boolean;
};

const EMPTY: OnboardingStatus = {
  companyId: null,
  items: {
    meu_restaurante: false,
    cardapio: false,
    pagamentos: false,
    whatsapp: false,
    pedido_teste: false,
  },
  completed: 0,
  total: 5,
  percent: 0,
  done: false,
};

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingStatus> => {
    const caller = await getCaller(context.userId);
    const companyId = caller.companyId;
    if (!companyId) return EMPTY;

    // 1. Meu Restaurante: nome + telefone preenchidos
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name, phone, pagamento_metodos")
      .eq("id", companyId)
      .maybeSingle();

    const meu_restaurante =
      !!company?.name?.trim() && !!company?.phone?.toString().trim();

    // 3. Pagamentos: ≥1 método ativo
    const metodos = (company?.pagamento_metodos ?? {}) as Record<string, boolean>;
    const pagamentos = Object.values(metodos).some((v) => v === true);

    // 2. Cardápio: ≥1 categoria ativa + ≥1 produto ativo
    const [{ count: catCount }, { count: prodCount }] = await Promise.all([
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
    const cardapio = (catCount ?? 0) > 0 && (prodCount ?? 0) > 0;

    // 4. WhatsApp: ≥1 conexão ativa/conectada
    const { count: waCount } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("active", true)
      .eq("status", "conectado");
    const whatsapp = (waCount ?? 0) > 0;

    // 5. Pedido teste: ≥1 pedido criado
    const { count: pedCount } = await supabaseAdmin
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    const pedido_teste = (pedCount ?? 0) > 0;

    const items = { meu_restaurante, cardapio, pagamentos, whatsapp, pedido_teste };
    const completed = Object.values(items).filter(Boolean).length;
    const total = 5;
    const percent = Math.round((completed / total) * 100);

    return {
      companyId,
      items,
      completed,
      total,
      percent,
      done: completed === total,
    };
  });
