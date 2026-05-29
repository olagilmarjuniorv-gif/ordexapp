import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

export const FIN_PERIODS = ["hoje", "ontem", "7d", "mes"] as const;
export type FinPeriod = typeof FIN_PERIODS[number];

function periodRange(p: FinPeriod): { from: string; to: string } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from: Date;
  let to: Date;
  if (p === "hoje") {
    from = startOfDay;
    to = new Date(startOfDay.getTime() + 24 * 3600 * 1000);
  } else if (p === "ontem") {
    to = startOfDay;
    from = new Date(startOfDay.getTime() - 24 * 3600 * 1000);
  } else if (p === "7d") {
    from = new Date(startOfDay.getTime() - 6 * 24 * 3600 * 1000);
    to = new Date(startOfDay.getTime() + 24 * 3600 * 1000);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

const inputSchema = z.object({
  period: z.enum(FIN_PERIODS).default("hoje"),
  companyId: z.string().uuid().nullable().optional(),
});

export const getFinanceiroOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const caller = await getCaller(context.userId);

    // Acesso: admin, super_admin, atendente (visualização)
    if (!caller.isAdmin && caller.role !== "atendente") {
      throw new Response("Acesso negado", { status: 403 });
    }

    // Escopo de empresa
    let companyId: string | null = caller.companyId;
    if (caller.isSuperAdmin && data.companyId) companyId = data.companyId;
    if (!companyId) {
      return {
        cards: {
          faturamento: 0,
          pedidos_pagos: 0,
          aguardando: 0,
          a_receber_entrega: 0,
          a_receber_retirada: 0,
          ticket_medio: 0,
        },
        pedidos: [],
      };
    }

    const { from, to } = periodRange(data.period);

    const { data: rows, error } = await supabaseAdmin
      .from("pedidos")
      .select(
        "id, created_at, status, total_amount, canal, forma_pagamento, status_financeiro, cliente:clientes(id, name, phone)",
      )
      .eq("company_id", companyId)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: false });

    if (error) throw new Response(error.message, { status: 500 });

    const list = (rows ?? []).filter((p: any) => p.status_financeiro !== "cancelado" && p.status !== "cancelado");

    let faturamento = 0;
    let pedidos_pagos = 0;
    let aguardando = 0;
    let a_receber_entrega = 0;
    let a_receber_retirada = 0;
    let pagosTotal = 0;

    for (const p of list as any[]) {
      const v = Number(p.total_amount ?? 0);
      const sf = p.status_financeiro as string;
      if (sf === "pago") {
        faturamento += v;
        pedidos_pagos += 1;
        pagosTotal += v;
      } else if (sf === "aguardando_pagamento") {
        aguardando += v;
      } else if (sf === "pagamento_entrega") {
        a_receber_entrega += v;
      } else if (sf === "pagamento_retirada") {
        a_receber_retirada += v;
      }
    }

    const ticket_medio = pedidos_pagos > 0 ? pagosTotal / pedidos_pagos : 0;

    return {
      cards: {
        faturamento,
        pedidos_pagos,
        aguardando,
        a_receber_entrega,
        a_receber_retirada,
        ticket_medio,
      },
      pedidos: rows ?? [],
    };
  });
