-- Storage bucket público para imagens de produtos/combos
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas: leitura pública; usuários autenticados podem upload na pasta da própria empresa
DROP POLICY IF EXISTS "Public read produtos bucket" ON storage.objects;
CREATE POLICY "Public read produtos bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'produtos');

DROP POLICY IF EXISTS "Authenticated upload produtos" ON storage.objects;
CREATE POLICY "Authenticated upload produtos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'produtos');

DROP POLICY IF EXISTS "Authenticated update produtos" ON storage.objects;
CREATE POLICY "Authenticated update produtos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'produtos');

DROP POLICY IF EXISTS "Authenticated delete produtos" ON storage.objects;
CREATE POLICY "Authenticated delete produtos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'produtos');

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_produtos_company_active ON public.produtos(company_id, active);
CREATE INDEX IF NOT EXISTS idx_produtos_category ON public.produtos(category_id);
CREATE INDEX IF NOT EXISTS idx_categorias_company ON public.categorias(company_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_combos_company ON public.combos(company_id, active);
CREATE INDEX IF NOT EXISTS idx_adic_grupos_company ON public.adicionais_grupos(company_id);

-- Triggers de updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tg_categorias_updated_at') THEN
    CREATE TRIGGER tg_categorias_updated_at BEFORE UPDATE ON public.categorias
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tg_combos_updated_at') THEN
    CREATE TRIGGER tg_combos_updated_at BEFORE UPDATE ON public.combos
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tg_adic_grupos_updated_at') THEN
    CREATE TRIGGER tg_adic_grupos_updated_at BEFORE UPDATE ON public.adicionais_grupos
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;