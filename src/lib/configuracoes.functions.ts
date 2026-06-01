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
  seg: HORARIO_DIA, ter: HORARIO_DIA, qua: HORARIO_DIA, qui: HORARIO_DIA,
  sex: HORARIO_DIA, sab: HORARIO_DIA, dom: HORARIO_DIA,
});
const CANAIS_SCHEMA = z.object({
  whatsapp: z.boolean(), balcao: z.boolean(), mesa: z.boolean(),
  delivery: z.boolean(), ifood: z.boolean(),
});
const MENSAGENS_SCHEMA = z.object({
  loja_fechada: z.string().max(500),
  recebido: z.string().max(500),
  preparo: z.string().max(500),
  pronto: z.string().max(500),
  finalizado: z.string().max(500),
});

const strOpt = z.string().trim().max(200).optional().nullable();
const emailOpt = z.string().trim().email().max(200).optional().nullable().or(z.literal(""));
const phoneOpt = z.string().trim().max(40).optional().nullable();
const onlyDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

async function assertAdminOfCompany(userId: string, companyId: string) {
  const c = await getCaller(userId);
  if (c.isSuperAdmin) return c;
  if (!c.isCompanyAdmin || c.companyId !== companyId) {
    throw new Error("Acesso negado");
  }
  return c;
}

// =========== GET ALL ===========
export const getConfiguracoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    const targetId = data.companyId ?? c.companyId;
    if (!targetId) return null;
    if (!c.isSuperAdmin && targetId !== c.companyId) throw new Error("Acesso negado");

    const [company, subscription, conexao, fluxo, counts] = await Promise.all([
      supabaseAdmin.from("companies").select("*").eq("id", targetId).maybeSingle(),
      supabaseAdmin.from("company_subscriptions").select("*").eq("company_id", targetId).maybeSingle(),
      supabaseAdmin.from("whatsapp_conexoes").select("*").eq("company_id", targetId).maybeSingle(),
      supabaseAdmin.from("whatsapp_fluxos").select("*").eq("company_id", targetId).maybeSingle(),
      (async () => {
        const startMonth = new Date();
        startMonth.setDate(1); startMonth.setHours(0, 0, 0, 0);
        const iso = startMonth.toISOString();
        const [p, conv, u] = await Promise.all([
          supabaseAdmin.from("pedidos").select("id", { count: "exact", head: true }).eq("company_id", targetId).gte("created_at", iso),
          supabaseAdmin.from("whatsapp_conversas").select("id", { count: "exact", head: true }).eq("company_id", targetId).gte("created_at", iso),
          supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", targetId).eq("active", true),
        ]);
        return { pedidos: p.count ?? 0, conversas: conv.count ?? 0, usuarios: u.count ?? 0 };
      })(),
    ]);

    return {
      company: company.data,
      subscription: subscription.data,
      conexao: conexao.data,
      fluxo: fluxo.data,
      uso: counts,
    };
  });

// =========== ABA 1 — EMPRESA ===========
export const updateEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
      razao_social: strOpt,
      cnpj: z.string().trim().max(20).optional().nullable()
        .refine((v) => !v || onlyDigits(v).length === 14, "CNPJ inválido"),
      inscricao_estadual: strOpt,
      phone: phoneOpt,
      email: emailOpt,
      email_financeiro: emailOpt,
      email_operacional: emailOpt,
      responsavel_nome: strOpt,
      responsavel_cpf: z.string().trim().max(20).optional().nullable()
        .refine((v) => !v || onlyDigits(v).length === 11, "CPF inválido"),
      responsavel_telefone: phoneOpt,
      cep: z.string().trim().max(15).optional().nullable()
        .refine((v) => !v || onlyDigits(v).length === 8, "CEP inválido"),
      rua: strOpt, numero: strOpt, complemento: strOpt,
      bairro: strOpt, cidade: strOpt, estado: strOpt,
      nome_publico: strOpt,
      telefone_publico: phoneOpt,
      endereco_publico: strOpt,
    }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOfCompany(context.userId, data.id);
    const { id, ...rest } = data;
    const payload = Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, v === "" ? null : v]),
    ) as any;
    const { error } = await supabaseAdmin.from("companies").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =========== ABA 2 — OPERAÇÃO ===========
export const updateOperacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      canais_ativos: CANAIS_SCHEMA,
      delivery_ativo: z.boolean(),
      retirada_ativa: z.boolean(),
      horarios: HORARIOS_SCHEMA,
      tempo_preparo_min: z.number().int().min(0).max(600),
      tempo_entrega_min: z.number().int().min(0).max(600),
      pedido_minimo: z.number().min(0).max(100000),
      taxa_entrega: z.number().min(0).max(100000),
      raio_entrega_km: z.number().min(0).max(500),
      mensagens_operacionais: MENSAGENS_SCHEMA,
    }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOfCompany(context.userId, data.id);
    const { id, ...rest } = data;
    const { error } = await supabaseAdmin.from("companies").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =========== ABA 3 — WHATSAPP (settings) ===========
export const updateWhatsappConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      bot_habilitado: z.boolean(),
      humano_habilitado: z.boolean(),
      auto_status: z.boolean(),
    }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOfCompany(context.userId, data.companyId);
    const { data: row } = await supabaseAdmin
      .from("whatsapp_conexoes").select("id, settings").eq("company_id", data.companyId).maybeSingle();
    const next = {
      ...((row?.settings as Record<string, unknown> | null) ?? {}),
      bot_habilitado: data.bot_habilitado,
      humano_habilitado: data.humano_habilitado,
      auto_status: data.auto_status,
    };
    if (row?.id) {
      const { error } = await supabaseAdmin.from("whatsapp_conexoes").update({ settings: next }).eq("id", row.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("whatsapp_conexoes")
        .insert({ company_id: data.companyId, settings: next, status: "desconectado" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// =========== ABA 6 — CHATBOT ===========
export const updateChatbot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      ativo: z.boolean(),
      mensagem_boas_vindas: z.string().max(1000),
      mensagem_fechamento: z.string().max(1000),
      mensagem_sem_atendimento: z.string().max(1000),
    }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOfCompany(context.userId, data.companyId);
    const { companyId, ...rest } = data;
    const { data: existing } = await supabaseAdmin
      .from("whatsapp_fluxos").select("id").eq("company_id", companyId).maybeSingle();
    if (existing?.id) {
      const { error } = await supabaseAdmin.from("whatsapp_fluxos").update(rest).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("whatsapp_fluxos").insert({ company_id: companyId, ...rest });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// =========== ABA 7 — PRIVACIDADE ===========
export const createPrivacyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      tipo: z.enum(["exportacao", "encerramento"]),
      notes: z.string().max(1000).optional(),
    }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOfCompany(context.userId, data.companyId);
    const { error } = await supabaseAdmin.from("privacy_requests").insert({
      company_id: data.companyId,
      tipo: data.tipo,
      solicitado_por: context.userId,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPrivacyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdminOfCompany(context.userId, data.companyId);
    const { data: rows, error } = await supabaseAdmin
      .from("privacy_requests").select("*").eq("company_id", data.companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
