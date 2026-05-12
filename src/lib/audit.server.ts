import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuditInput = {
  companyId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

// Best-effort: nunca derruba o fluxo principal por falha de log.
export async function audit(input: AuditInput) {
  try {
    let userName: string | null = null;
    if (input.userId) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("full_name, username")
        .eq("id", input.userId)
        .maybeSingle();
      userName = (data?.full_name as string) || (data?.username as string) || null;
    }
    await supabaseAdmin.from("audit_logs").insert({
      company_id: input.companyId,
      user_id: input.userId,
      user_name: userName,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      description: input.description ?? null,
      metadata: (input.metadata ?? {}) as any,
    });
  } catch (e) {
    // swallow
    console.error("[audit] failed", e);
  }
}
