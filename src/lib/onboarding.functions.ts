import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    console.warn("[OBF] A handler start, userId=", context.userId);
    const caller = await getCaller(context.userId);
    const companyId = caller.companyId;
    console.warn("[OBF] B caller", { companyId, role: (caller as any).role });

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

    if (!companyId) { console.warn("[OBF] C no companyId, return empty"); return empty; }

    const companyRes = await supabaseAdmin
      .from("companies")
      .select("name, phone, email, pagamento_metodos")
      .eq("id", companyId)
      .maybeSingle();
    console.warn("[OBF] D company", { error: companyRes.error, data: companyRes.data });
    const company = companyRes.data;

    const meu_restaurante =
      !!company?.name?.trim() &&
      !!company?.phone?.toString().trim() &&
      !!company?.email?.toString().trim();

    const metodos = (company?.pagamento_metodos ?? {}) as Record<string, boolean>;
    const pagamentos = Object.values(metodos).some((v) => v === true);
    console.warn("[OBF] E meu_restaurante/pagamentos", { meu_restaurante, pagamentos, metodosType: typeof company?.pagamento_metodos });

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
    console.warn("[OBF] F cat/prod", { catErr: catRes.error, catCount: catRes.count, prodErr: prodRes.error, prodCount: prodRes.count });
    const cardapio = (catRes.count ?? 0) > 0 && (prodRes.count ?? 0) > 0;

    const waRes = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("active", true)
      .eq("status", "conectado");
    console.warn("[OBF] G whatsapp", { err: waRes.error, count: waRes.count });
    const whatsapp = (waRes.count ?? 0) > 0;

    const pedRes = await supabaseAdmin
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    console.warn("[OBF] H pedidos", { err: pedRes.error, count: pedRes.count });
    const pedido_teste = (pedRes.count ?? 0) > 0;

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
