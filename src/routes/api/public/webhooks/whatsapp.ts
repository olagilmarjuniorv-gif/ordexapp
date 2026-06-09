import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWhatsappCloud } from "@/lib/whatsapp.server";
import { processInboundMessage } from "@/lib/whatsapp-engine.server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "saiupedido-dev-verify";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const FALLBACK_TOKEN = process.env.WHATSAPP_META_TOKEN;
const FALLBACK_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

function verifySignature(rawBody: string, signature: string | null): boolean {
  const runtimeSecret = process.env.WHATSAPP_APP_SECRET ?? APP_SECRET;
  // [DEBUG-HMAC] logs temporários para auditoria
  console.log("[DEBUG-HMAC] secret_exists_module_scope:", !!APP_SECRET);
  console.log("[DEBUG-HMAC] secret_exists_runtime:", !!runtimeSecret);
  console.log("[DEBUG-HMAC] secret_length:", runtimeSecret?.length ?? 0);
  console.log("[DEBUG-HMAC] raw_body_length:", rawBody.length);
  console.log("[DEBUG-HMAC] signature_received:", signature);

  if (!runtimeSecret) {
    console.log("[DEBUG-HMAC] APP_SECRET ausente — pulando verificação");
    return true;
  }
  if (!signature) {
    console.log("[DEBUG-HMAC] header x-hub-signature-256 ausente");
    return false;
  }
  const expected = "sha256=" + createHmac("sha256", runtimeSecret).update(rawBody).digest("hex");
  console.log("[DEBUG-HMAC] signature_expected:", expected);
  console.log("[DEBUG-HMAC] lengths recv/exp:", signature.length, expected.length);

  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      console.log("[DEBUG-HMAC] buffer length mismatch — retornando false");
      return false;
    }
    const ok = timingSafeEqual(a, b);
    console.log("[DEBUG-HMAC] timingSafeEqual result:", ok);
    return ok;
  } catch (e: any) {
    console.log("[DEBUG-HMAC] exceção em timingSafeEqual:", e?.message);
    return false;
  }
}

type Resolved = {
  conexaoId: string | null;
  companyId: string | null;
  token: string | null;
  phoneNumberId: string | null;
};

async function resolveConnection(phoneNumberId: string | null): Promise<Resolved> {
  if (phoneNumberId) {
    const { data } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("id, company_id, access_token, phone_number_id, active")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();
    if (data?.active) {
      return {
        conexaoId: data.id as string,
        companyId: data.company_id as string,
        token: (data.access_token as string) ?? FALLBACK_TOKEN ?? null,
        phoneNumberId: (data.phone_number_id as string) ?? phoneNumberId,
      };
    }
  }
  return {
    conexaoId: null,
    companyId: null,
    token: FALLBACK_TOKEN ?? null,
    phoneNumberId: phoneNumberId ?? FALLBACK_PHONE_ID ?? null,
  };
}

async function upsertConversa(companyId: string, conexaoId: string, customerPhone: string, lastMessage: string) {
  const nowIso = new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select("id, unread_count")
    .eq("company_id", companyId)
    .eq("customer_phone", customerPhone)
    .maybeSingle();
  if (existing) {
    await supabaseAdmin
      .from("whatsapp_conversas")
      .update({
        last_message: lastMessage.slice(0, 500),
        last_message_at: nowIso,
        unread_count: (existing.unread_count ?? 0) + 1,
        status: "aberta",
      })
      .eq("id", existing.id);
    return existing.id as string;
  }
  const { data: ins, error } = await supabaseAdmin
    .from("whatsapp_conversas")
    .insert({
      company_id: companyId,
      conexao_id: conexaoId,
      customer_phone: customerPhone,
      last_message: lastMessage.slice(0, 500),
      last_message_at: nowIso,
      unread_count: 1,
      status: "aberta",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return ins.id as string;
}

async function saveMensagem(opts: {
  companyId: string;
  conversaId: string;
  direction: "in" | "out";
  content: string;
  externalId?: string | null;
  status?: string;
  raw?: any;
}) {
  await supabaseAdmin.from("whatsapp_mensagens").insert({
    company_id: opts.companyId,
    conversa_id: opts.conversaId,
    direction: opts.direction,
    message_type: "text",
    content: opts.content,
    external_message_id: opts.externalId ?? null,
    status: opts.status ?? "received",
    raw_payload: opts.raw ?? {},
  });
}

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      // Verificação Meta
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-hub-signature-256");
        if (!verifySignature(raw, sig)) {
          return new Response("invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        try {
          const entries = payload?.entry ?? [];
          for (const entry of entries) {
            for (const change of entry?.changes ?? []) {
              const value = change?.value ?? {};
              const phoneNumberId = value?.metadata?.phone_number_id as string | undefined;
              const messages = value?.messages ?? [];

              if (messages.length === 0) continue;

              const resolved = await resolveConnection(phoneNumberId ?? null);
              if (!resolved.companyId || !resolved.conexaoId) {
                console.warn("[whatsapp] mensagem ignorada — phone_number_id sem conexão", phoneNumberId);
                continue;
              }

              for (const m of messages) {
                const from = m?.from as string | undefined;
                if (!from) continue;
                const text =
                  (m?.text?.body as string | undefined) ??
                  (m?.button?.text as string | undefined) ??
                  (m?.interactive?.button_reply?.title as string | undefined) ??
                  "[mensagem não suportada]";

                const conversaId = await upsertConversa(
                  resolved.companyId,
                  resolved.conexaoId,
                  from,
                  text,
                );

                await saveMensagem({
                  companyId: resolved.companyId,
                  conversaId,
                  direction: "in",
                  content: text,
                  externalId: (m?.id as string) ?? null,
                  status: "received",
                  raw: m,
                });

                // Processa via motor conversacional
                if (resolved.token && resolved.phoneNumberId) {
                  let reply: string | null = null;
                  try {
                    reply = await processInboundMessage({
                      companyId: resolved.companyId,
                      conexaoId: resolved.conexaoId,
                      phone: from,
                      text,
                    });
                  } catch (engineErr: any) {
                    console.error("[whatsapp-engine] erro:", engineErr?.message);
                    reply = "Desculpe, tivemos um problema. Tente novamente em instantes.";
                  }

                  if (reply) {
                    const res = await sendWhatsappCloud({
                      phoneNumberId: resolved.phoneNumberId,
                      to: from,
                      body: reply,
                      token: resolved.token,
                    });
                    await saveMensagem({
                      companyId: resolved.companyId,
                      conversaId,
                      direction: "out",
                      content: reply,
                      status: res.ok ? "sent" : "failed",
                      raw: res.raw,
                    });
                    if (!res.ok) {
                      await supabaseAdmin
                        .from("whatsapp_conexoes")
                        .update({ last_error: String(res.raw?.error?.message ?? "send failed").slice(0, 300) })
                        .eq("id", resolved.conexaoId);
                    }
                  }
                }
              }

              await supabaseAdmin
                .from("whatsapp_conexoes")
                .update({ last_sync_at: new Date().toISOString(), last_error: null })
                .eq("id", resolved.conexaoId);
            }
          }
        } catch (e: any) {
          console.error("[whatsapp] webhook error", e?.message);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
