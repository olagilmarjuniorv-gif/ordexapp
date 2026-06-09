// SERVER ONLY — Phase 3 part 2.
// Ativação automática de assinatura após pagamento confirmado no Asaas.
// Chamado APENAS pelo webhook /api/public/webhooks/asaas após PAYMENT_RECEIVED
// (ou PAYMENT_CONFIRMED em sandbox).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

function addDaysISODate(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const LIMITES: Record<string, { pedidos: number; conversas: number; usuarios: number }> = {
  base: { pedidos: 300, conversas: 300, usuarios: 1 },
  pro: { pedidos: 1500, conversas: 1500, usuarios: 3 },
  max: { pedidos: 0, conversas: 3000, usuarios: 8 },
};

/**
 * Marca a cobrança como paga, marca a intent como paga e ativa a assinatura
 * da empresa. Idempotente — se a intent já estiver `pago`, não refaz nada.
 */
export async function activateSubscriptionFromPayment(input: {
  intentId: string;
  paymentExternalId: string;
  asaasStatus?: string;
  invoiceUrl?: string | null;
  eventId: string;
  eventType: string;
}): Promise<{ activated: boolean; reason?: string }> {
  const { data: intent, error: iErr } = await supabaseAdmin
    .from("subscription_intents")
    .select("*")
    .eq("id", input.intentId)
    .maybeSingle();
  if (iErr) throw new Error(iErr.message);
  if (!intent) return { activated: false, reason: "intent_not_found" };

  if (intent.status === "pago") {
    // já processado; ainda assim garantir paid_at na cobrança
    await supabaseAdmin
      .from("cobrancas")
      .update({ status: "pago", paid_at: new Date().toISOString() })
      .eq("gateway", "asaas")
      .eq("external_id", input.paymentExternalId)
      .is("paid_at", null);
    return { activated: false, reason: "already_paid" };
  }

  const { data: plano, error: pErr } = await supabaseAdmin
    .from("planos_catalogo")
    .select("valor_mensal, valor_anual")
    .eq("codigo", intent.plano)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  const valor = Number(
    intent.ciclo === "anual" ? plano?.valor_anual ?? 0 : plano?.valor_mensal ?? 0,
  );

  const nowIso = new Date().toISOString();
  const dias = intent.ciclo === "anual" ? 365 : 30;
  const vencimento = addDaysISODate(dias);

  // 1) cobrança → paga
  await supabaseAdmin
    .from("cobrancas")
    .update({
      status: "pago",
      paid_at: nowIso,
      metadata: {
        last_event_id: input.eventId,
        last_event_type: input.eventType,
        invoice_url: input.invoiceUrl ?? null,
        asaas_status: input.asaasStatus ?? null,
      } as never,
    })
    .eq("gateway", "asaas")
    .eq("external_id", input.paymentExternalId);

  // 2) intent → paga
  await supabaseAdmin
    .from("subscription_intents")
    .update({ status: "pago" })
    .eq("id", intent.id);

  // 3) ativar assinatura
  const lim = LIMITES[intent.plano] ?? LIMITES.base;
  const { error: sErr } = await supabaseAdmin
    .from("company_subscriptions")
    .update({
      plano: intent.plano,
      ciclo: intent.ciclo,
      status: "ativo",
      inicio: nowIso,
      vencimento,
      proxima_cobranca: vencimento,
      valor,
      limite_pedidos_mes: lim.pedidos,
      limite_conversas_mes: lim.conversas,
      limite_usuarios: lim.usuarios,
      payment_method: "pix",
      external_status: (input.asaasStatus ?? "RECEIVED").toLowerCase(),
      external_sync_at: nowIso,
      gateway: "asaas",
    })
    .eq("company_id", intent.company_id);
  if (sErr) throw new Error(sErr.message);

  return { activated: true };
}
