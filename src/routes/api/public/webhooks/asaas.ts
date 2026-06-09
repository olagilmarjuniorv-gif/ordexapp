// Public webhook for Asaas billing events.
// URL: /api/public/webhooks/asaas
//
// Phase 3 part 1: receives events, validates the access token,
// guarantees idempotency via `asaas_webhook_events.event_id`,
// and persists payload + cobrança snapshot.
//
// DOES NOT activate plans, change subscription status, or run business
// rules yet — that lands in Phase 3 part 2.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { upsertCobranca } from "@/lib/asaas-payments";

const SUPPORTED_EVENTS = new Set([
  "PAYMENT_CREATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_UPDATED",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mapStatus(asaasStatus?: string): string {
  const s = (asaasStatus ?? "").toUpperCase();
  switch (s) {
    case "PENDING":
      return "pendente";
    case "CONFIRMED":
      return "confirmado";
    case "RECEIVED":
    case "RECEIVED_IN_CASH":
      return "pago";
    case "OVERDUE":
      return "vencido";
    case "REFUNDED":
    case "REFUND_REQUESTED":
      return "estornado";
    case "DELETED":
      return "cancelado";
    default:
      return (asaasStatus ?? "pendente").toLowerCase();
  }
}

function mapBillingType(t?: string): string | null {
  const v = (t ?? "").toUpperCase();
  if (v === "PIX") return "pix";
  if (v === "CREDIT_CARD") return "cartao";
  if (v === "BOLETO") return "boleto";
  return null;
}

export const Route = createFileRoute("/api/public/webhooks/asaas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
        const provided = request.headers.get("asaas-access-token");

        if (!expected) {
          console.error("[asaas-webhook] ASAAS_WEBHOOK_TOKEN não configurado");
          return new Response("misconfigured", { status: 500 });
        }
        if (!provided || provided !== expected) {
          return new Response("unauthorized", { status: 401 });
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const eventId: string | undefined = body?.id;
        const eventType: string | undefined = body?.event;
        const payment = body?.payment ?? null;
        const paymentId: string | null = payment?.id ?? null;

        if (!eventId || !eventType) {
          return new Response("missing event id/type", { status: 400 });
        }

        // Idempotency: try to insert event_id; if it already exists, ack quickly.
        const { error: insErr } = await supabaseAdmin
          .from("asaas_webhook_events")
          .insert({
            event_id: eventId,
            event: eventType,
            payment_id: paymentId,
            payload: body as never,
          });

        if (insErr) {
          // 23505 = unique_violation → duplicado, já processado
          const code = (insErr as { code?: string }).code;
          if (code === "23505") {
            return json({ success: true, duplicated: true });
          }
          console.error("[asaas-webhook] insert event failed", insErr.message);
          return json({ success: false }, 500);
        }

        // Snapshot da cobrança quando há payment + evento suportado.
        if (SUPPORTED_EVENTS.has(eventType) && payment?.id) {
          try {
            // Localiza company_id via externalReference da intent OU via customer_id.
            let companyId: string | null = null;
            let subscriptionId: string | null = null;

            const extRef: string | undefined = payment.externalReference;
            if (extRef?.startsWith("intent:")) {
              const intentId = extRef.slice("intent:".length);
              const { data: intent } = await supabaseAdmin
                .from("subscription_intents")
                .select("company_id")
                .eq("id", intentId)
                .maybeSingle();
              if (intent?.company_id) companyId = intent.company_id as string;
            }
            if (!companyId && payment.customer) {
              const { data: sub } = await supabaseAdmin
                .from("company_subscriptions")
                .select("id, company_id")
                .eq("customer_id", payment.customer)
                .maybeSingle();
              if (sub?.company_id) {
                companyId = sub.company_id as string;
                subscriptionId = (sub.id as string) ?? null;
              }
            }

            if (companyId) {
              await upsertCobranca({
                company_id: companyId,
                subscription_id: subscriptionId,
                external_id: payment.id,
                status: mapStatus(payment.status),
                payment_method: mapBillingType(payment.billingType),
                valor: Number(payment.value ?? 0),
                vencimento: payment.dueDate ?? null,
                metadata: {
                  last_event_id: eventId,
                  last_event_type: eventType,
                  invoice_url: payment.invoiceUrl ?? null,
                },
              });
            }

            await supabaseAdmin
              .from("asaas_webhook_events")
              .update({ processed_at: new Date().toISOString() })
              .eq("event_id", eventId);
          } catch (err) {
            console.error(
              "[asaas-webhook] snapshot cobrança falhou",
              (err as Error)?.message ?? err,
            );
            // Retorna 200 mesmo assim — o evento foi registrado e pode ser reprocessado manualmente.
          }
        }

        return json({ success: true });
      },
    },
  },
});
