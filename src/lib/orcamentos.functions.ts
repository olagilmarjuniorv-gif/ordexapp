
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Database } from "@/integrations/supabase/types";

type OrcamentoItem = Database['public']['Tables']['orcamentos']['Row']['items'];

// Schemas based on the real database structure
const orcamentoItemSchema = z.object({
  product_id: z.string(),
  quantity: z.number().min(1),
});

const orcamentoSchema = z.object({
  id: z.string().optional(),
  client_id: z.string(),
  items: z.array(orcamentoItemSchema).min(1, "O orçamento precisa ter pelo menos um item."),
});

// Statuses should be in English to match the DB. The UI can translate them.
const statusSchema = z.enum(["draft", "sent", "approved", "rejected"]);

/**
 * Fetches the company ID for the currently authenticated user.
 * Throws an error if the user is not found or not linked to a company.
 */
async function getCompanyId(supabase: any, userId: string): Promise<string> {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .single();

    if (error || !profile?.company_id) {
        throw new Error("Usuário não encontrado ou não associado a uma empresa.");
    }
    return profile.company_id;
}


/**
 * Fetches all orçamentos for the user's company.
 */
export const getOrcamentos = createServerFn("query", async () => {
  const { supabase, user } = await requireSupabaseAuth();
  const companyId = await getCompanyId(supabase, user.id);

  const { data, error } = await supabase
    .from("orcamentos")
    .select("id, status, total_amount, created_at, cliente:clientes(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orçamentos:", error);
    throw error;
  }
  return data;
});

/**
 * Fetches a single orçamento by its ID, ensuring it belongs to the user's company.
 */
export const getOrcamento = createServerFn("query", async (id: string) => {
  if (!id) return null;
  const { supabase, user } = await requireSupabaseAuth();
  const companyId = await getCompanyId(supabase, user.id);

  const { data, error } = await supabase
    .from("orcamentos")
    .select("*, cliente:clientes(id, name)")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) {
    console.error(`Error fetching orçamento ${id}:`, error);
    throw error;
  }
  return data;
});

/**
 * Creates a new orcamento or updates an existing one if it's a draft.
 */
export const saveOrcamento = createServerFn("mutation", async (data: z.infer<typeof orcamentoSchema>) => {
  const { supabase, user } = await requireSupabaseAuth();
  const companyId = await getCompanyId(supabase, user.id);
  const { id, client_id, items } = orcamentoSchema.parse(data);

  // 1. Validate products and fetch their real prices from the DB
  const productIds = items.map((item) => item.product_id);
  const { data: products, error: productError } = await supabase
    .from("produtos")
    .select("id, price")
    .in("id", productIds)
    .eq("company_id", companyId);

  if (productError) throw new Error("Falha ao validar os produtos.");
  if (products.length !== productIds.length) {
    throw new Error("Um ou mais produtos não foram encontrados ou não pertencem à sua empresa.");
  }

  // 2. Calculate total_amount on the backend and build final items array
  const priceMap = new Map(products.map(p => [p.id, p.price]));
  let total_amount = 0;
  const finalItems: OrcamentoItem = items.map(item => {
    const price = priceMap.get(item.product_id);
    if (price === undefined) throw new Error(`Preço para o produto ${item.product_id} não encontrado.`);
    
    const numericPrice = Number(price);
    total_amount += item.quantity * numericPrice;
    return {
      product_id: item.product_id,
      quantity: item.quantity,
      price: numericPrice,
    };
  });

  const orcamentoPayload = {
    client_id,
    company_id: companyId,
    user_id: user.id,
    items: finalItems,
    total_amount,
    status: 'draft',
  };

  // 3. Insert or Update logic
  if (id) {
    // UPDATE: Only drafts can be edited
    const { data: existing, error: fetchError } = await supabase
      .from("orcamentos")
      .select("status")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (fetchError || !existing) throw new Error("Orçamento não encontrado.");
    if (existing.status !== 'draft') {
      throw new Error("Apenas orçamentos com status 'rascunho' podem ser editados.");
    }

    const { data: updatedData, error: updateError } = await supabase
      .from("orcamentos")
      .update(orcamentoPayload)
      .eq("id", id)
      .select("id")
      .single();

    if (updateError) throw updateError;
    return updatedData;

  } else {
    // INSERT
    const { data: newData, error: insertError } = await supabase
      .from("orcamentos")
      .insert(orcamentoPayload)
      .select("id")
      .single();

    if (insertError) throw insertError;
    return newData;
  }
});

/**
 * Updates the status of an orçamento.
 */
export const updateOrcamentoStatus = createServerFn("mutation", async ({ id, status }: { id: string; status: z.infer<typeof statusSchema>}) => {
  const { supabase, user } = await requireSupabaseAuth();
  const companyId = await getCompanyId(supabase, user.id);
  const validatedStatus = statusSchema.parse(status);

  // Check if orcamento exists and belongs to the company before updating
  const { error: fetchError } = await supabase
      .from("orcamentos")
      .select("id")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

  if (fetchError) throw new Error("Orçamento não encontrado ou não pertence à sua empresa.");

  const { error: updateError } = await supabase
    .from("orcamentos")
    .update({ status: validatedStatus })
    .eq("id", id);

  if (updateError) {
    console.error(`Error updating orçamento status ${id}:`, updateError);
    throw updateError;
  }

  return { success: true };
});
