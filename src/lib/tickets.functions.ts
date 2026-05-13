import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCaller } from "./auth.server";

export const TICKET_PRIORITIES = ["baixa", "normal", "alta", "urgente"] as const;
export const TICKET_STATUSES = ["aberto", "em_andamento", "aguardando", "resolvido", "fechado"] as const;
export const TICKET_CATEGORIES = ["duvida", "bug", "melhoria", "financeiro", "outro"] as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });

    let q = supabaseAdmin
      .from("tickets")
      .select("id, company_id, created_by, title, category, priority, status, last_message_at, created_at, updated_at")
      .order("last_message_at", { ascending: false });

    if (!c.isSuperAdmin) {
      if (!c.companyId) return [];
      q = q.eq("company_id", c.companyId);
    }
    const { data, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });

    const tickets = data ?? [];
    if (tickets.length === 0) return [];

    const companyIds = Array.from(new Set(tickets.map((t) => t.company_id)));
    const userIds = Array.from(new Set(tickets.map((t) => t.created_by)));

    const [{ data: companies }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("companies").select("id, name").in("id", companyIds),
      supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds),
    ]);
    const cMap = new Map((companies ?? []).map((x) => [x.id, x.name]));
    const pMap = new Map((profiles ?? []).map((x) => [x.id, x.full_name]));

    return tickets.map((t) => ({
      ...t,
      company_name: cMap.get(t.company_id) ?? null,
      created_by_name: pMap.get(t.created_by) ?? null,
    }));
  });

export const getTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });

    const { data: t, error } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!t) throw new Response("Chamado não encontrado", { status: 404 });
    if (!c.isSuperAdmin && t.company_id !== c.companyId) {
      throw new Response("Acesso negado", { status: 403 });
    }

    const { data: messages } = await supabaseAdmin
      .from("ticket_mensagens")
      .select("id, author_id, author_role, body, created_at")
      .eq("ticket_id", data.id)
      .order("created_at", { ascending: true });

    const ids = Array.from(new Set((messages ?? []).map((m) => m.author_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const pMap = new Map((profiles ?? []).map((x) => [x.id, x.full_name]));

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", t.company_id)
      .maybeSingle();

    return {
      ticket: { ...t, company_name: company?.name ?? null },
      messages: (messages ?? []).map((m) => ({ ...m, author_name: pMap.get(m.author_id) ?? "Usuário" })),
    };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(140),
        description: z.string().trim().min(5).max(4000),
        category: z.enum(TICKET_CATEGORIES).default("duvida"),
        priority: z.enum(TICKET_PRIORITIES).default("normal"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isCompanyAdmin) throw new Response("Apenas admin da empresa pode abrir chamado", { status: 403 });
    if (!c.companyId) throw new Response("Sem empresa", { status: 400 });

    const { data: created, error } = await supabaseAdmin
      .from("tickets")
      .insert({
        company_id: c.companyId,
        created_by: c.userId,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        status: "aberto",
      })
      .select("id")
      .single();
    if (error) throw new Response(error.message, { status: 500 });

    await supabaseAdmin.from("ticket_mensagens").insert({
      ticket_id: created.id,
      author_id: c.userId,
      author_role: "admin",
      body: data.description,
    });

    return { id: created.id };
  });

export const replyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ticket_id: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });

    const { data: t } = await supabaseAdmin
      .from("tickets")
      .select("id, company_id, status")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (!t) throw new Response("Chamado não encontrado", { status: 404 });
    if (!c.isSuperAdmin && t.company_id !== c.companyId) {
      throw new Response("Acesso negado", { status: 403 });
    }

    const role = c.isSuperAdmin ? "super_admin" : "admin";

    const { error } = await supabaseAdmin.from("ticket_mensagens").insert({
      ticket_id: data.ticket_id,
      author_id: c.userId,
      author_role: role,
      body: data.body,
    });
    if (error) throw new Response(error.message, { status: 500 });

    // Atualiza last_message_at + auto status
    let newStatus = t.status;
    if (c.isSuperAdmin && t.status === "aberto") newStatus = "em_andamento";
    if (!c.isSuperAdmin && t.status === "aguardando") newStatus = "em_andamento";

    await supabaseAdmin
      .from("tickets")
      .update({ last_message_at: new Date().toISOString(), status: newStatus })
      .eq("id", data.ticket_id);

    return { ok: true };
  });

export const setTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ticket_id: z.string().uuid(), status: z.enum(TICKET_STATUSES) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const c = await getCaller(context.userId);
    if (!c.isAdmin) throw new Response("Acesso negado", { status: 403 });

    const { data: t } = await supabaseAdmin
      .from("tickets")
      .select("company_id")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (!t) throw new Response("Chamado não encontrado", { status: 404 });
    if (!c.isSuperAdmin && t.company_id !== c.companyId) {
      throw new Response("Acesso negado", { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("tickets")
      .update({ status: data.status })
      .eq("id", data.ticket_id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });
