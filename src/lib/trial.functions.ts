import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";
import { computeTrial } from "./trial";

/**
 * Retorna o status do trial da empresa do caller.
 * Super admin sempre recebe expirado=false (não é bloqueado).
 */
export const getTrialStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    if (c.isSuperAdmin || !c.companyId) {
      return { isTrial: false, expirado: false, diasRestantes: null, vencimento: null, status: null };
    }
    const { data } = await supabaseAdmin
      .from("company_subscriptions")
      .select("status, vencimento")
      .eq("company_id", c.companyId)
      .maybeSingle();
    const info = computeTrial(data?.status, data?.vencimento as string | null | undefined);
    return {
      isTrial: info.isTrial,
      expirado: info.expirado,
      diasRestantes: info.diasRestantes,
      vencimento: info.vencimento,
      status: info.status,
    };
  });
