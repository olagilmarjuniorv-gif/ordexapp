import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";
import {
  normalizeIfoodOrder,
  pollIfoodOrders,
  refreshIfoodToken,
  type NormalizedIfoodOrder,
} from "./ifood.server";

const PROVIDER = "ifood";

async function logEvent(
  integrationId: string,
  companyId: string,
  level: "info" | "warn" | "error",
  message: string,
  payload: unknown = {},
) {
  await supabaseAdmin.from("integracao_logs").insert({
    integration_id: integrationId,
    company_id: companyId,
    level,
    message,
    payload: payload as any,
  });
}

export const listIntegracoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });

    let q = supabaseAdmin
      .from("integracoes")
      .select("*")
      .order("created_at", { ascending: false });
    if (!c.isSuperAdmin) {
      if (!c.companyId) return [];
      q = q.eq("company_id", c.companyId);
    }
    const { data, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const listIntegracaoLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ integration_id: z.string().uuid(), limit: z.number().int().min(1).max(100).default(20) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });
    let q = supabaseAdmin
      .from("integracao_logs")
      .select("*")
      .eq("integration_id", data.integration_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (!c.isSuperAdmin) {
      if (!c.companyId) return [];
      q = q.eq("company_id", c.companyId);
    }
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

export const connectIfood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      merchant_id: z.string().trim().min(1).max(120),
      settings: z.record(z.string(), z.unknown()).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin || !c.companyId) throw new Response("Acesso negado", { status: 403 });

    let token: { access_token: string; expires_in: number; mocked: boolean };
    try {
      token = await refreshIfoodToken();
    } catch (e: any) {
      throw new Response(`Falha ao autenticar iFood: ${e.message}`, { status: 400 });
    }
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    const { data: row, error } = await supabaseAdmin
      .from("integracoes")
      .upsert(
        {
          company_id: c.companyId,
          provider: PROVIDER,
          merchant_id: data.merchant_id,
          access_token: token.access_token,
          token_expires_at: expiresAt,
          active: true,
          status: "conectado",
          last_error: null,
          settings: (data.settings ?? { mocked: token.mocked }) as any,
        },
        { onConflict: "company_id,provider" },
      )
      .select("*")
      .single();
    if (error || !row) throw new Response(error?.message ?? "Erro", { status: 500 });
    await logEvent(row.id, c.companyId, "info", "Integração iFood conectada", { mocked: token.mocked });
    return row;
  });

export const disconnectIfood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin || !c.companyId) throw new Response("Acesso negado", { status: 403 });

    let q = supabaseAdmin
      .from("integracoes")
      .update({ active: false, status: "desconectado", access_token: null, refresh_token: null })
      .eq("id", data.id);
    if (!c.isSuperAdmin) q = q.eq("company_id", c.companyId);
    const { error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    await logEvent(data.id, c.companyId, "info", "Integração desconectada");
    return { ok: true };
  });

export const syncIfoodNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin || !c.companyId) throw new Response("Acesso negado", { status: 403 });

    let q = supabaseAdmin.from("integracoes").select("*").eq("id", data.id);
    if (!c.isSuperAdmin) q = q.eq("company_id", c.companyId);
    const { data: integ, error } = await q.maybeSingle();
    if (error || !integ) throw new Response("Integração não encontrada", { status: 404 });
    if (!integ.active) throw new Response("Integração inativa", { status: 400 });

    await supabaseAdmin
      .from("integracoes")
      .update({ status: "sincronizando", last_sync_at: new Date().toISOString() })
      .eq("id", integ.id);

    let imported = 0;
    let skipped = 0;
    try {
      const orders: NormalizedIfoodOrder[] = await pollIfoodOrders(
        integ.access_token as string | null,
        integ.merchant_id as string | null,
      );

      for (const o of orders) {
        const totalWithFee = o.total_amount + (o.delivery_fee ?? 0);

        // Resolve / create cliente by phone.
        let clientId: string | null = null;
        if (o.customer.phone) {
          const { data: existing } = await supabaseAdmin
            .from("clientes")
            .select("id")
            .eq("company_id", integ.company_id as string)
            .eq("phone", o.customer.phone)
            .maybeSingle();
          if (existing) {
            clientId = existing.id as string;
          } else {
            const { data: created } = await supabaseAdmin
              .from("clientes")
              .insert({
                company_id: integ.company_id as string,
                name: o.customer.name ?? "Cliente iFood",
                phone: o.customer.phone,
                address: o.customer.address,
              })
              .select("id")
              .single();
            clientId = (created?.id as string) ?? null;
          }
        }

        const { error: insErr } = await supabaseAdmin.from("pedidos").insert({
          company_id: integ.company_id as string,
          user_id: c.userId,
          client_id: clientId,
          canal: "delivery",
          status: "novo",
          total_amount: totalWithFee,
          items: o.items as any,
          observacao: o.observacao,
          external_provider: PROVIDER,
          external_order_id: o.external_order_id,
          external_payload: o.raw as any,
          imported_at: new Date().toISOString(),
        });

        if (insErr) {
          // Duplicate (unique idx) → skipped, otherwise log error.
          if ((insErr as any).code === "23505") {
            skipped++;
          } else {
            await logEvent(integ.id, integ.company_id as string, "error", "Falha ao importar pedido", {
              external_order_id: o.external_order_id,
              error: insErr.message,
            });
          }
        } else {
          imported++;
        }
      }

      await supabaseAdmin
        .from("integracoes")
        .update({
          status: "conectado",
          last_sync_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", integ.id);

      await logEvent(integ.id, integ.company_id as string, "info", "Sincronização concluída", {
        imported,
        skipped,
        total: orders.length,
      });

      return { ok: true, imported, skipped, total: orders.length };
    } catch (e: any) {
      await supabaseAdmin
        .from("integracoes")
        .update({ status: "erro", last_error: String(e?.message ?? e) })
        .eq("id", integ.id);
      await logEvent(integ.id, integ.company_id as string, "error", "Falha de sincronização", {
        error: String(e?.message ?? e),
      });
      throw new Response(`Sync falhou: ${e.message}`, { status: 500 });
    }
  });

export const getIfoodStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ company_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });
    const companyId = c.isSuperAdmin ? data.company_id ?? c.companyId : c.companyId;
    if (!companyId) return { importedToday: 0 };

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("external_provider", PROVIDER)
      .gte("imported_at", start.toISOString());
    return { importedToday: count ?? 0 };
  });

// Webhook stub — wired later when iFood Portal approves webhook callback URL.
// Server route lives under src/routes/api/public/webhooks/ifood.ts (future).
export const ifoodWebhookPlaceholder = createServerFn({ method: "POST" }).handler(async () => {
  return { ok: true, note: "webhook não habilitado nesta fase" };
});
