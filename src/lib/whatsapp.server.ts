import { supabaseAdmin } from "@/integrations/supabase/client.server";

const META_TOKEN = process.env.WHATSAPP_META_TOKEN;
const META_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
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

export async function dispatchWhatsapp(toPhone: string, body: string): Promise<SendResult> {
  if (!META_TOKEN || !META_PHONE_ID) {
    return { ok: true, mocked: true, status: "mocked", raw: { to: toPhone, body } };
  }
  try {
    const res = await fetch(`${META_GRAPH}/${META_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${META_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone(toPhone),
        type: "text",
        text: { body },
      }),
    });
    const raw = await res.json().catch(() => ({}));
    return { ok: res.ok, mocked: false, status: res.ok ? "sent" : "failed", raw };
  } catch (e: any) {
    return { ok: false, mocked: false, status: "failed", raw: { error: e?.message ?? String(e) } };
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
