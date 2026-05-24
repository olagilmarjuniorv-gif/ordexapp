import { supabaseAdmin } from "@/integrations/supabase/client.server";

const META_GRAPH = "https://graph.facebook.com/v20.0";

export type SendResult = {
  ok: boolean;
  mocked: boolean;
  status: string;
  raw: any;
};

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function maskToken(t?: string | null): string {
  if (!t) return "—";
  if (t.length <= 8) return "****";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/**
 * Envia mensagem via Meta Cloud API.
 * Usa phone_number_id passado (multiempresa) ou fallback para env.
 */
export async function sendWhatsappCloud(opts: {
  phoneNumberId: string;
  to: string;
  body: string;
  token: string;
}): Promise<SendResult> {
  const { phoneNumberId, to, body, token } = opts;
  if (!token || !phoneNumberId) {
    return { ok: true, mocked: true, status: "mocked", raw: { to, body } };
  }
  try {
    const res = await fetch(`${META_GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone(to),
        type: "text",
        text: { body, preview_url: false },
      }),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[whatsapp] send failed", res.status, JSON.stringify(raw)?.slice(0, 500));
    }
    return { ok: res.ok, mocked: false, status: res.ok ? "sent" : "failed", raw };
  } catch (e: any) {
    console.error("[whatsapp] send exception", e?.message);
    return { ok: false, mocked: false, status: "failed", raw: { error: e?.message ?? String(e) } };
  }
}

/**
 * Dispatch genérico (compatibilidade): usa env padrão se nenhuma conexão for fornecida.
 */
export async function dispatchWhatsapp(toPhone: string, body: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_META_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { ok: true, mocked: true, status: "mocked", raw: { to: toPhone, body } };
  }
  return sendWhatsappCloud({ phoneNumberId, to: toPhone, body, token });
}

/**
 * Valida token e phone_number_id chamando o endpoint do número Meta.
 */
export async function pingMetaPhoneNumber(opts: {
  phoneNumberId: string;
  token: string;
}): Promise<{ ok: boolean; status: number; display_phone_number?: string; verified_name?: string; error?: string }> {
  try {
    const res = await fetch(
      `${META_GRAPH}/${opts.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${opts.token}` } },
    );
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[whatsapp] ping failed", res.status, `token=${maskToken(opts.token)}`);
      return { ok: false, status: res.status, error: raw?.error?.message ?? "ping failed" };
    }
    return {
      ok: true,
      status: res.status,
      display_phone_number: raw?.display_phone_number,
      verified_name: raw?.verified_name,
    };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message ?? String(e) };
  }
}

export async function persistMessage(input: {
  company_id: string;
  cliente_id?: string | null;
  pedido_id?: string | null;
  direction: "in" | "out";
  body: string;
  status: string;
  raw_payload?: any;
}) {
  const { error } = await supabaseAdmin.from("mensagens").insert({
    company_id: input.company_id,
    cliente_id: input.cliente_id ?? null,
    pedido_id: input.pedido_id ?? null,
    direction: input.direction,
    body: input.body,
    status: input.status,
    raw_payload: input.raw_payload ?? {},
  });
  if (error) throw new Error(error.message);
}

export function templateForStatus(status: string, ctx: { clienteName?: string; mesa?: string; total?: number }): string | null {
  const nome = ctx.clienteName ? `, ${ctx.clienteName}` : "";
  switch (status) {
    case "novo":
      return `Olá${nome}! Recebemos seu pedido${ctx.mesa ? ` (Mesa ${ctx.mesa})` : ""}. Já estamos preparando 🍽️`;
    case "pronto":
      return `Olá${nome}! Seu pedido está pronto${ctx.mesa ? ` na Mesa ${ctx.mesa}` : ""}. Bom apetite! 🎉`;
    case "pago":
      return `Obrigado${nome}! Recebemos o pagamento${typeof ctx.total === "number" ? ` de R$ ${ctx.total.toFixed(2)}` : ""}. Volte sempre! 🙌`;
    default:
      return null;
  }
}

export const WELCOME_MESSAGE =
  "Olá! Seja bem-vindo ao SaiuPedido. Para fazer seu pedido, envie uma mensagem com o item desejado ou aguarde o atendimento.";
