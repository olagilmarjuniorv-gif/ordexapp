// SERVER ONLY — Asaas customer + cobrança helpers.
// Imported only from server fns / server routes (e.g., webhook handler).
// Does NOT activate plans nor mutate company_subscriptions.status here.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { asaasFetch, assertBillingDataComplete, AsaasError } from "./asaas.server";

// ---------- Types ----------

export type AsaasCustomer = {
  id: string;
  name?: string;
  email?: string;
  cpfCnpj?: string;
  mobilePhone?: string;
};

export type AsaasPayment = {
  id: string;
  customer: string;
  billingType: "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED";
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string;
  externalReference?: string;
};

export type AsaasPixQrCode = {
  encodedImage: string; // base64 PNG
  payload: string; // copia-e-cola
  expirationDate?: string;
};

// ---------- Customer ----------

/**
 * Garante a existência de um Customer no Asaas para a empresa.
 * - reutiliza company_subscriptions.customer_id quando disponível
 * - caso contrário, cria no Asaas e persiste customer_id + gateway='asaas'
 */
export async function ensureAsaasCustomer(companyId: string): Promise<string> {
  const { data: company, error: cErr } = await supabaseAdmin
    .from("companies")
    .select(
      "id, name, razao_social, email, email_financeiro, phone, whatsapp, responsavel_telefone, cnpj, responsavel_cpf",
    )
    .eq("id", companyId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!company) throw new Error("Empresa não encontrada");

  assertBillingDataComplete(company);

  const { data: sub } = await supabaseAdmin
    .from("company_subscriptions")
    .select("id, customer_id, gateway")
    .eq("company_id", companyId)
    .maybeSingle();

  if (sub?.customer_id) return sub.customer_id as string;

  const digits = (v?: string | null) => (v ?? "").replace(/\D/g, "");
  const cpfCnpj = digits(company.cnpj) || digits(company.responsavel_cpf);
  const phone =
    digits(company.responsavel_telefone) ||
    digits(company.whatsapp) ||
    digits(company.phone);

  const payload = {
    name: (company.razao_social ?? company.name ?? "").trim(),
    email: (company.email_financeiro ?? company.email ?? "").trim(),
    cpfCnpj,
    mobilePhone: phone,
    externalReference: companyId,
    notificationDisabled: false,
  };

  const created = await asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: payload,
  });

  if (!created?.id) throw new AsaasError("Asaas não retornou customer.id", 502, created);

  // upsert customer_id + gateway na assinatura existente (trial). NÃO altera status.
  if (sub?.id) {
    await supabaseAdmin
      .from("company_subscriptions")
      .update({ customer_id: created.id, gateway: "asaas" })
      .eq("id", sub.id);
  } else {
    await supabaseAdmin
      .from("company_subscriptions")
      .update({ customer_id: created.id, gateway: "asaas" })
      .eq("company_id", companyId);
  }

  return created.id;
}

// ---------- Cobrança ----------

export async function findCobrancaByExternalId(externalId: string) {
  const { data } = await supabaseAdmin
    .from("cobrancas")
    .select("*")
    .eq("gateway", "asaas")
    .eq("external_id", externalId)
    .maybeSingle();
  return data ?? null;
}

export async function upsertCobranca(input: {
  company_id: string;
  subscription_id?: string | null;
  external_id: string;
  status: string;
  payment_method?: string | null;
  valor: number;
  vencimento?: string | null; // YYYY-MM-DD
  ciclo?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const existing = await findCobrancaByExternalId(input.external_id);
  const mergedMeta = { ...((existing?.metadata as Record<string, unknown>) ?? {}), ...(input.metadata ?? {}) };

  const row = {
    company_id: input.company_id,
    subscription_id: input.subscription_id ?? existing?.subscription_id ?? null,
    gateway: "asaas",
    external_id: input.external_id,
    status: input.status,
    payment_method: input.payment_method ?? existing?.payment_method ?? null,
    valor: input.valor,
    vencimento: input.vencimento ?? existing?.vencimento ?? null,
    ciclo: input.ciclo ?? existing?.ciclo ?? null,
    metadata: mergedMeta as never,
  };

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("cobrancas")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabaseAdmin
    .from("cobrancas")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ---------- PIX ----------

function addDaysISO(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Cria cobrança PIX no Asaas (Sandbox) a partir de uma subscription_intent.
 * Server-side only. Ainda NÃO exposto na UI (Fase 3 parte 1 = preparação).
 *
 * Retorna { payment_id, invoice_url, pix: { payload, encodedImage } }.
 * NÃO ativa plano nem altera company_subscriptions.status.
 */
export async function createPixPayment(intentId: string): Promise<{
  payment_id: string;
  invoice_url?: string;
  pix: AsaasPixQrCode;
  valor: number;
  vencimento: string;
}> {
  const { data: intent, error: iErr } = await supabaseAdmin
    .from("subscription_intents")
    .select("*")
    .eq("id", intentId)
    .maybeSingle();
  if (iErr) throw new Error(iErr.message);
  if (!intent) throw new Error("Intent não encontrada");
  if (intent.status !== "aguardando_pagamento") {
    throw new Error(`Intent não está aguardando pagamento (status=${intent.status})`);
  }

  const { data: plano, error: pErr } = await supabaseAdmin
    .from("planos_catalogo")
    .select("valor_mensal, valor_anual")
    .eq("codigo", intent.plano)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!plano) throw new Error("Plano não encontrado no catálogo");

  const valor = Number(intent.ciclo === "anual" ? plano.valor_anual : plano.valor_mensal);
  if (!valor || valor <= 0) throw new Error("Valor do plano inválido");

  // Anti-duplicidade: se a intent já tem um payment Asaas registrado,
  // reaproveita em vez de criar nova cobrança.
  const intentMeta = (intent.metadata as Record<string, unknown> | null) ?? {};
  const existingPaymentId = (intentMeta.asaas_payment_id as string | undefined) ?? null;
  if (existingPaymentId) {
    try {
      const existing = await asaasFetch<AsaasPayment>(`/payments/${existingPaymentId}`, { method: "GET" });
      const reusable = existing && ["PENDING", "AWAITING_PAYMENT", "OVERDUE"].includes(String(existing.status).toUpperCase());
      if (reusable) {
        const pix = await asaasFetch<AsaasPixQrCode>(`/payments/${existingPaymentId}/pixQrCode`, { method: "GET" });
        return {
          payment_id: existing.id,
          invoice_url: existing.invoiceUrl,
          pix,
          valor: Number(existing.value ?? valor),
          vencimento: existing.dueDate ?? addDaysISO(3),
        };
      }
    } catch {
      // se falhar a recuperação, segue criando uma nova
    }
  }

  const customerId = await ensureAsaasCustomer(intent.company_id);
  const dueDate = addDaysISO(3);

  const payment = await asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: {
      customer: customerId,
      billingType: "PIX",
      value: valor,
      dueDate,
      description: `SaiuPedido — plano ${intent.plano} (${intent.ciclo})`,
      externalReference: `intent:${intent.id}`,
    },
  });

  const pix = await asaasFetch<AsaasPixQrCode>(`/payments/${payment.id}/pixQrCode`, {
    method: "GET",
  });

  const { data: sub } = await supabaseAdmin
    .from("company_subscriptions")
    .select("id")
    .eq("company_id", intent.company_id)
    .maybeSingle();

  await upsertCobranca({
    company_id: intent.company_id,
    subscription_id: sub?.id ?? null,
    external_id: payment.id,
    status: payment.status?.toLowerCase() ?? "pendente",
    payment_method: "pix",
    valor,
    vencimento: dueDate,
    ciclo: intent.ciclo,
    metadata: {
      intent_id: intent.id,
      plano: intent.plano,
      invoice_url: payment.invoiceUrl ?? null,
      pix_expires_at: pix.expirationDate ?? null,
    },
  });

  await supabaseAdmin
    .from("subscription_intents")
    .update({
      metadata: {
        ...((intent.metadata as Record<string, unknown>) ?? {}),
        asaas_payment_id: payment.id,
        asaas_invoice_url: payment.invoiceUrl ?? null,
      } as never,
    })
    .eq("id", intent.id);

  return {
    payment_id: payment.id,
    invoice_url: payment.invoiceUrl,
    pix,
    valor,
    vencimento: dueDate,
  };
}

// ---------- CARTÃO DE CRÉDITO (checkout hospedado Asaas) ----------

/**
 * Cria cobrança CREDIT_CARD no Asaas e retorna a invoiceUrl (checkout hospedado).
 * SaiuPedido NÃO captura dados de cartão — o cliente preenche tudo no domínio Asaas.
 * Reusa cobrança existente (mesma intent) quando possível.
 * NÃO ativa plano nem altera company_subscriptions.status — webhook cuida disso.
 */
export async function createCardPayment(intentId: string): Promise<{
  payment_id: string;
  invoice_url: string;
  valor: number;
  vencimento: string;
}> {
  const { data: intent, error: iErr } = await supabaseAdmin
    .from("subscription_intents")
    .select("*")
    .eq("id", intentId)
    .maybeSingle();
  if (iErr) throw new Error(iErr.message);
  if (!intent) throw new Error("Intent não encontrada");
  if (intent.status !== "aguardando_pagamento") {
    throw new Error(`Intent não está aguardando pagamento (status=${intent.status})`);
  }

  const { data: plano, error: pErr } = await supabaseAdmin
    .from("planos_catalogo")
    .select("valor_mensal, valor_anual")
    .eq("codigo", intent.plano)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!plano) throw new Error("Plano não encontrado no catálogo");

  const valor = Number(intent.ciclo === "anual" ? plano.valor_anual : plano.valor_mensal);
  if (!valor || valor <= 0) throw new Error("Valor do plano inválido");

  // Anti-duplicidade: reaproveita a cobrança Asaas vinculada à intent quando reutilizável.
  const intentMeta = (intent.metadata as Record<string, unknown> | null) ?? {};
  const existingPaymentId = (intentMeta.asaas_payment_id as string | undefined) ?? null;
  if (existingPaymentId) {
    try {
      const existing = await asaasFetch<AsaasPayment>(`/payments/${existingPaymentId}`, { method: "GET" });
      const reusable =
        existing &&
        ["PENDING", "AWAITING_PAYMENT", "OVERDUE"].includes(String(existing.status).toUpperCase()) &&
        !!existing.invoiceUrl;
      if (reusable) {
        return {
          payment_id: existing.id,
          invoice_url: existing.invoiceUrl!,
          valor: Number(existing.value ?? valor),
          vencimento: existing.dueDate ?? addDaysISO(3),
        };
      }
    } catch {
      // segue criando nova
    }
  }

  const customerId = await ensureAsaasCustomer(intent.company_id);
  const dueDate = addDaysISO(3);

  const payment = await asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: {
      customer: customerId,
      billingType: "CREDIT_CARD",
      value: valor,
      dueDate,
      description: `SaiuPedido — plano ${intent.plano} (${intent.ciclo})`,
      externalReference: `intent:${intent.id}`,
    },
  });

  if (!payment?.invoiceUrl) {
    throw new AsaasError("Asaas não retornou invoiceUrl para CREDIT_CARD", 502, payment);
  }

  const { data: sub } = await supabaseAdmin
    .from("company_subscriptions")
    .select("id")
    .eq("company_id", intent.company_id)
    .maybeSingle();

  await upsertCobranca({
    company_id: intent.company_id,
    subscription_id: sub?.id ?? null,
    external_id: payment.id,
    status: payment.status?.toLowerCase() ?? "pendente",
    payment_method: "cartao",
    valor,
    vencimento: dueDate,
    ciclo: intent.ciclo,
    metadata: {
      intent_id: intent.id,
      plano: intent.plano,
      invoice_url: payment.invoiceUrl,
    },
  });

  await supabaseAdmin
    .from("subscription_intents")
    .update({
      metadata: {
        ...((intent.metadata as Record<string, unknown>) ?? {}),
        asaas_payment_id: payment.id,
        asaas_invoice_url: payment.invoiceUrl,
      } as never,
    })
    .eq("id", intent.id);

  return {
    payment_id: payment.id,
    invoice_url: payment.invoiceUrl,
    valor,
    vencimento: dueDate,
  };
}
