import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ROLES = ["super_admin", "admin", "atendente", "cozinha"] as const;
export const COMPANY_ROLES = ["admin", "atendente", "cozinha"] as const;
export type AppRole = (typeof ROLES)[number];

export type Caller = {
  userId: string;
  role: AppRole | null;
  companyId: string | null;
  isSuperAdmin: boolean;
  /** alias for company-level admin (role === "admin") */
  isCompanyAdmin: boolean;
  /** true for super_admin OR admin */
  isAdmin: boolean;
};

export async function getCaller(userId: string): Promise<Caller> {
  const [{ data: r }, { data: p }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
  ]);
  const role = (r?.role as AppRole | undefined) ?? null;
  const isSuperAdmin = role === "super_admin";
  const isCompanyAdmin = role === "admin";
  return {
    userId,
    role,
    companyId: (p?.company_id as string | null) ?? null,
    isSuperAdmin,
    isCompanyAdmin,
    isAdmin: isSuperAdmin || isCompanyAdmin,
  };
}

export function assertAdminish(c: Caller): void {
  if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });
}

export function assertCompanyScope(c: Caller): string {
  if (!c.companyId) throw new Response("Usuário sem empresa", { status: 403 });
  return c.companyId;
}

/**
 * Bloqueia operações de escrita quando o Trial expirou.
 * Super admin nunca é bloqueado.
 * Retorna silenciosamente quando o trial está ativo ou o status não é trial.
 */
export async function assertTrialAtivo(c: Caller): Promise<void> {
  if (c.isSuperAdmin) return;
  if (!c.companyId) return; // outro guard cuidará
  const { data } = await supabaseAdmin
    .from("company_subscriptions")
    .select("status, vencimento")
    .eq("company_id", c.companyId)
    .maybeSingle();
  if (!data) return;
  if (data.status !== "trial") return;
  if (!data.vencimento) return;
  const venc = new Date(data.vencimento + "T23:59:59");
  if (Number.isNaN(venc.getTime())) return;
  if (venc.getTime() < Date.now()) {
    throw new Response("Trial expirado. Solicite ao administrador que escolha um plano.", { status: 402 });
  }
}
