import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";
import {
  getAsaasBaseUrl,
  getAsaasEnv,
  validateBillingData,
  type BillingValidation,
} from "./asaas.server";

/**
 * Status seguro da configuração Asaas. Nunca retorna valores de secrets —
 * apenas se estão presentes. Acesso restrito a super_admin.
 */
export const getAsaasConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    if (!c.isSuperAdmin) throw new Response("Acesso negado", { status: 403 });

    return {
      ambiente: getAsaasEnv(),
      baseUrl: getAsaasBaseUrl(),
      hasApiKey: Boolean(process.env.ASAAS_API_KEY?.trim()),
      hasWebhookToken: Boolean(process.env.ASAAS_WEBHOOK_TOKEN?.trim()),
      hasBaseUrlOverride: Boolean(process.env.ASAAS_BASE_URL?.trim()),
    };
  });

/**
 * Verifica se a empresa do caller tem os dados fiscais necessários para
 * iniciar um checkout futuro. Não chama o Asaas. Não cria cobrança.
 * Retorna { ok, missing } para o frontend exibir aviso amigável.
 */
export const checkBillingReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingValidation> => {
    const c = await getCaller(context.userId);
    if (!c.companyId) return { ok: false, missing: ["nome", "cpf_cnpj", "email", "telefone"] };

    const { data } = await supabaseAdmin
      .from("companies")
      .select(
        "name, razao_social, email, email_financeiro, phone, whatsapp, responsavel_telefone, cnpj, responsavel_cpf",
      )
      .eq("id", c.companyId)
      .maybeSingle();

    return validateBillingData(data);
  });
