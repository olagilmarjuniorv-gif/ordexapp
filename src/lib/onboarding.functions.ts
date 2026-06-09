import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    console.log("[OBF] A handler start, userId=", context.userId);
    const caller = await getCaller(context.userId);
    const companyId = caller.companyId;
    console.log("[OBF] B caller", { companyId, role: (caller as any).role });

    const empty = {
      companyId: null as string | null,
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

    if (!companyId) return empty;

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name, phone, email, pagamento_metodos")
      .eq("id", companyId)
      .maybeSingle();

    const meu_restaurante =
      !!company?.name?.trim() &&
      !!company?.phone?.toString().trim() &&
      !!company?.email?.toString().trim();


    const metodos = (company?.pagamento_metodos ?? {}) as Record<string, boolean>;
    const pagamentos = Object.values(metodos).some((v) => v === true);

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

    const { count: waCount } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("active", true)
      .eq("status", "conectado");
    const whatsapp = (waCount ?? 0) > 0;

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
      companyId: companyId as string | null,
      items,
      completed,
      total,
      percent,
      done: completed === total,
    };
  });
