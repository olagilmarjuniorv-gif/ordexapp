
CREATE OR REPLACE FUNCTION public.get_company_sales_ranking()
RETURNS TABLE(company_id uuid, company_name text, total_sales numeric)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        c.id as company_id,
        c.name as company_name,
        COALESCE(SUM(p.total_amount), 0) as total_sales
    FROM 
        public.companies c
    LEFT JOIN 
        public.pedidos p ON c.id = p.company_id AND p.status = 'completed'
    GROUP BY
        c.id, c.name
    ORDER BY
        total_sales DESC
    LIMIT 10;
$$;
