// ServerFn para criar checkout de Cartão (invoiceUrl Asaas).
// SaiuPedido NÃO captura dados de cartão. O cliente é redirecionado
// para o checkout hospedado do Asaas; o webhook existente ativa a assinatura.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getCaller } from "./auth.server";

const IntentIdInput = z.object({ intentId: z.string().uuid() });

export type CardCheckoutDTO = {
  intent_id: string;
  plano: string;
  ciclo: "mensal" | "anual";
  valor: number;
  vencimento: string;
  payment_id: string;
  invoice_url: string;
};

export const createCardCheckoutForIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IntentIdInput.parse(d))
  .handler(async ({ context, data }): Promise<CardCheckoutDTO> => {
    const c = await getCaller(context.userId);
    if (!c.companyId) throw new Response("Usuário sem empresa", { status: 403 });
    if (!c.isCompanyAdmin && !c.isSuperAdmin) {
      throw new Response("Apenas administradores podem gerar pagamentos", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: intent, error } = await supabaseAdmin
      .from("subscription_intents")
      .select("*")
      .eq("id", data.intentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!intent) throw new Response("Intent não encontrada", { status: 404 });
    if (intent.company_id !== c.companyId) {
      throw new Response("Acesso negado", { status: 403 });
    }
    if (intent.status !== "aguardando_pagamento") {
      throw new Response(`Intent não está aguardando pagamento (${intent.status})`, { status: 409 });
    }

    const { createCardPayment } = await import("./asaas-payments");
    const result = await createCardPayment(intent.id);

    return {
      intent_id: intent.id,
      plano: intent.plano,
      ciclo: intent.ciclo as "mensal" | "anual",
      valor: result.valor,
      vencimento: result.vencimento,
      payment_id: result.payment_id,
      invoice_url: result.invoice_url,
    };
  });
