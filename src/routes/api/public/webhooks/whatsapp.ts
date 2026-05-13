import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { persistMessage } from "@/lib/whatsapp.server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "ordex-dev-verify";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!APP_SECRET) return true; // dev/mock — skip when secret not configured
  if (!signature) return false;
  const expected = "sha256=" +
    createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      // Meta webhook verification
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
              const messages = value?.messages ?? [];
              for (const m of messages) {
                const from = m?.from as string | undefined;
                const text = m?.text?.body as string | undefined;
                if (!from || !text) continue;

                const cleaned = from.replace(/\D/g, "");
                const { data: cli } = await supabaseAdmin
                  .from("clientes")
                  .select("id, company_id")
                  .ilike("phone", `%${cleaned.slice(-8)}%`)
                  .limit(1)
                  .maybeSingle();
                if (!cli) continue;

                await persistMessage({
                  company_id: cli.company_id as string,
                  cliente_id: cli.id as string,
                  direction: "in",
                  body: text,
                  status: "received",
                  raw_payload: m,
                });
              }
            }
          }
        } catch (e) {
          console.error("whatsapp webhook error", e);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
