
CREATE OR REPLACE FUNCTION public.create_pedido_and_update_stock(
    p_company_id uuid,
    p_user_id uuid,
    p_orcamento_id uuid,
    p_client_id uuid,
    p_total_amount numeric,
    p_items jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_pedido_id uuid;
    item_record record;
BEGIN
    -- 1. Create a new pedido
    INSERT INTO public.pedidos(company_id, user_id, orcamento_id, client_id, total_amount, items, status)
    VALUES (p_company_id, p_user_id, p_orcamento_id, p_client_id, p_total_amount, p_items, 'pending')
    RETURNING id INTO new_pedido_id;

    -- 2. Update stock for each product in the items
    FOR item_record IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity numeric)
    LOOP
        UPDATE public.produtos
        SET stock = stock - item_record.quantity
        WHERE id = item_record.product_id AND company_id = p_company_id;
    END LOOP;

    -- 3. Return the new pedido ID
    RETURN json_build_object('id', new_pedido_id);
END;
$$;
