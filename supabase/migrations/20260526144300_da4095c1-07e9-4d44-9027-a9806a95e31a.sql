
CREATE OR REPLACE FUNCTION public.seed_default_categorias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  defaults text[] := ARRAY[
    'Hambúrgueres','Combos','Porções','Bebidas','Sobremesas',
    'Mais vendidos','Promoções','Novidades','Favoritos da casa'
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(defaults, 1) LOOP
    INSERT INTO public.categorias (company_id, name, sort_order, active)
    VALUES (NEW.id, defaults[i], i - 1, true);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_categorias ON public.companies;
CREATE TRIGGER trg_seed_default_categorias
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_default_categorias();

-- Backfill para empresas existentes sem categorias
DO $$
DECLARE
  c RECORD;
  defaults text[] := ARRAY[
    'Hambúrgueres','Combos','Porções','Bebidas','Sobremesas',
    'Mais vendidos','Promoções','Novidades','Favoritos da casa'
  ];
  i int;
BEGIN
  FOR c IN
    SELECT co.id FROM public.companies co
    WHERE NOT EXISTS (SELECT 1 FROM public.categorias ca WHERE ca.company_id = co.id)
  LOOP
    FOR i IN 1..array_length(defaults, 1) LOOP
      INSERT INTO public.categorias (company_id, name, sort_order, active)
      VALUES (c.id, defaults[i], i - 1, true);
    END LOOP;
  END LOOP;
END $$;
