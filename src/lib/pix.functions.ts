// Client-safe server fns para o fluxo PIX (Sandbox).
// As implementações pesadas (Asaas, supabaseAdmin) ficam em módulos *.ts
// importados dentro do .handler() para não vazar pro bundle do cliente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getCaller } from "./auth.server";

const IntentIdInput = z.object({ intentId: z.string().uuid() });

export type PixPaymentDTO = {
  intent_id: string;
  plano: string;
  ciclo: "mensal" | "anual";
  valor: number;
  vencimento: string;
  payment_id: string;
  invoice_url?: string | null;
  qr_code_image: string; // base64 PNG (sem prefixo data:)
  qr_code_payload: string; // copia-e-cola
  expires_at?: string | null;
};

export type PaymentStatusDTO = {
  intent_id: string;
  status: "aguardando_pagamento" | "pago" | "cancelado" | "expirado";
  cobranca_status?: string | null;
  paid_at?: string | null;
  invoice_url?: string | null;
  qr_code_image?: string | null;
  qr_code_payload?: string | null;
  payment_id?: string | null;
  valor?: number;
  vencimento?: string | null;
  plano?: string;
  ciclo?: "mensal" | "anual";
};

async function loadIntent(intentId: string, callerCompanyId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("subscription_intents")
    .select("*")
    .eq("id", intentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Intent não encontrada", { status: 404 });
  if (data.company_id !== callerCompanyId) {
    throw new Response("Acesso negado", { status: 403 });
  }
  return data;
}

/**
 * Gera (ou retorna a já gerada) cobrança PIX para a intent informada.
 * Idempotente em nível de UI: se já houver um payment_id no metadata,
 * reaproveita e busca o QR Code novamente.
 */
export const createPixForIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IntentIdInput.parse(d))
  .handler(async ({ context, data }): Promise<PixPaymentDTO> => {
    const c = await getCaller(context.userId);
    if (!c.companyId) throw new Response("Usuário sem empresa", { status: 403 });
    if (!c.isCompanyAdmin && !c.isSuperAdmin) {
      throw new Response("Apenas administradores podem gerar pagamentos", { status: 403 });
    }

    const intent = await loadIntent(data.intentId, c.companyId);
    if (intent.status !== "aguardando_pagamento") {
      throw new Response(`Intent não está aguardando pagamento (${intent.status})`, {
        status: 409,
      });
    }

    const { createPixPayment } = await import("./asaas-payments");
    const result = await createPixPayment(intent.id);

    return {
      intent_id: intent.id,
      plano: intent.plano,
      ciclo: intent.ciclo as "mensal" | "anual",
      valor: result.valor,
      vencimento: result.vencimento,
      payment_id: result.payment_id,
      invoice_url: result.invoice_url ?? null,
      qr_code_image: result.pix.encodedImage,
      qr_code_payload: result.pix.payload,
      expires_at: result.pix.expirationDate ?? null,
    };
  });

/**
 * Retorna o status atual da intent + dados do PIX (quando existir).
 * Usado pelo polling da tela de pagamento.
 */
export const getSubscriptionPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IntentIdInput.parse(d))
  .handler(async ({ context, data }): Promise<PaymentStatusDTO> => {
    const c = await getCaller(context.userId);
    if (!c.companyId) throw new Response("Usuário sem empresa", { status: 403 });

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

    const meta = (intent.metadata as Record<string, unknown> | null) ?? {};
    const paymentId = (meta.asaas_payment_id as string | undefined) ?? null;

    let cobrancaStatus: string | null = null;
    let paidAt: string | null = null;
    let valor: number | undefined;
    let vencimento: string | null = null;
    if (paymentId) {
      const { data: cob } = await supabaseAdmin
        .from("cobrancas")
        .select("status, paid_at, valor, vencimento")
        .eq("gateway", "asaas")
        .eq("external_id", paymentId)
        .maybeSingle();
      if (cob) {
        cobrancaStatus = cob.status;
        paidAt = cob.paid_at;
        valor = Number(cob.valor);
        vencimento = cob.vencimento;
      }
    }

    return {
      intent_id: intent.id,
      status: intent.status as PaymentStatusDTO["status"],
      cobranca_status: cobrancaStatus,
      paid_at: paidAt,
      invoice_url: (meta.asaas_invoice_url as string | undefined) ?? null,
      qr_code_image: null, // não cacheado; QR vem do createPixForIntent
      qr_code_payload: null,
      payment_id: paymentId,
      valor,
      vencimento,
      plano: intent.plano,
      ciclo: intent.ciclo as "mensal" | "anual",
    };
  });
