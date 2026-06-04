import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

const HORARIO_DIA = z.object({
  abre: z.string().regex(/^\d{2}:\d{2}$/),
  fecha: z.string().regex(/^\d{2}:\d{2}$/),
  ativo: z.boolean(),
});

const HORARIOS_SCHEMA = z.object({
  seg: HORARIO_DIA,
  ter: HORARIO_DIA,
  qua: HORARIO_DIA,
  qui: HORARIO_DIA,
  sex: HORARIO_DIA,
  sab: HORARIO_DIA,
  dom: HORARIO_DIA,
});

export type HorariosFuncionamento = z.infer<typeof HORARIOS_SCHEMA>;

const FULL_FIELDS =
  "id, name, slug, phone, whatsapp, email, active, created_at, " +
  "cep, rua, numero, complemento, bairro, cidade, estado, " +
  "delivery_ativo, retirada_ativa, tempo_preparo_min, pedido_minimo, taxa_entrega, horarios, " +
  "pagamento_metodos, exigir_pagamento_antes_cozinha, permitir_pagamento_entrega, permitir_pagamento_retirada";

export const PAGAMENTO_METODOS = [
  "pix_online",
  "dinheiro",
  "credito_presencial",
  "debito_presencial",
  "pix_presencial",
  "pagamento_entrega",
  "pagamento_retirada",
] as const;
export type PagamentoMetodo = typeof PAGAMENTO_METODOS[number];
export type PagamentoMetodosConfig = Record<PagamentoMetodo, boolean>;

const PAGAMENTO_METODOS_SCHEMA = z.object({
  pix_online: z.boolean(),
  dinheiro: z.boolean(),
  credito_presencial: z.boolean(),
  debito_presencial: z.boolean(),
  pix_presencial: z.boolean(),
  pagamento_entrega: z.boolean(),
  pagamento_retirada: z.boolean(),
});

export const listCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    let q = supabaseAdmin
      .from("companies")
      .select("id, name, slug, phone, active, created_at")
      .order("name");

    if (!c.isSuperAdmin) {
      if (!c.companyId) return [];
      q = q.eq("id", c.companyId);
    }
    const { data, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const getCompanyById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    const targetId = data.id ?? c.companyId;
    if (!targetId) return null;
    if (!c.isSuperAdmin && targetId !== c.companyId) {
      throw new Response("Acesso negado", { status: 403 });
    }
    const { data: row, error } = await supabaseAdmin
      .from("companies")
      .select(FULL_FIELDS)
      .eq("id", targetId)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return row;
  });

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        slug: z.string().trim().max(60).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isSuperAdmin) {
      throw new Response("Acesso negado", { status: 403 });
    }
    const { data: created, error } = await supabaseAdmin
      .from("companies")
      .insert({
        name: data.name,
        slug: data.slug || null,
        phone: data.phone || null,
      })
      .select("id")
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { id: created.id };
  });

export const updateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        slug: z.string().trim().max(60).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isSuperAdmin && !(c.isCompanyAdmin && c.companyId === data.id)) {
      throw new Response("Acesso negado", { status: 403 });
    }
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ name: data.name, slug: data.slug || null, phone: data.phone || null })
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });


export const setCompanyActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isSuperAdmin) {
      throw new Response("Acesso negado", { status: 403 });
    }
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const updateCompanyPagamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        pagamento_metodos: PAGAMENTO_METODOS_SCHEMA,
        exigir_pagamento_antes_cozinha: z.boolean(),
        permitir_pagamento_entrega: z.boolean(),
        permitir_pagamento_retirada: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isSuperAdmin && !(c.isCompanyAdmin && c.companyId === data.id)) {
      throw new Response("Acesso negado", { status: 403 });
    }
    const { id, ...rest } = data;
    const { error } = await supabaseAdmin
      .from("companies")
      .update(rest)
      .eq("id", id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
