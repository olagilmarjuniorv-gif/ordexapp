
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'atendente';

CREATE TABLE IF NOT EXISTS public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage company categorias" ON public.categorias;
DROP POLICY IF EXISTS "Super admins manage all categorias" ON public.categorias;
CREATE POLICY "Members manage company categorias" ON public.categorias FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid())) WITH CHECK (company_id = get_user_company(auth.uid()));
CREATE POLICY "Super admins manage all categorias" ON public.categorias FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
DROP TRIGGER IF EXISTS trg_categorias_updated ON public.categorias;
CREATE TRIGGER trg_categorias_updated BEFORE UPDATE ON public.categorias
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.adicionais_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  min_select int NOT NULL DEFAULT 0,
  max_select int NOT NULL DEFAULT 1,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.adicionais_grupos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage company adicionais_grupos" ON public.adicionais_grupos;
DROP POLICY IF EXISTS "Super admins manage all adicionais_grupos" ON public.adicionais_grupos;
CREATE POLICY "Members manage company adicionais_grupos" ON public.adicionais_grupos FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid())) WITH CHECK (company_id = get_user_company(auth.uid()));
CREATE POLICY "Super admins manage all adicionais_grupos" ON public.adicionais_grupos FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.adicionais_opcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.adicionais_grupos(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.adicionais_opcoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage company adicionais_opcoes" ON public.adicionais_opcoes;
DROP POLICY IF EXISTS "Super admins manage all adicionais_opcoes" ON public.adicionais_opcoes;
CREATE POLICY "Members manage company adicionais_opcoes" ON public.adicionais_opcoes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.adicionais_grupos g WHERE g.id = grupo_id AND g.company_id = get_user_company(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.adicionais_grupos g WHERE g.id = grupo_id AND g.company_id = get_user_company(auth.uid())));
CREATE POLICY "Super admins manage all adicionais_opcoes" ON public.adicionais_opcoes FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.produto_grupos_adicionais (
  produto_id uuid NOT NULL,
  grupo_id uuid NOT NULL REFERENCES public.adicionais_grupos(id) ON DELETE CASCADE,
  PRIMARY KEY (produto_id, grupo_id)
);
ALTER TABLE public.produto_grupos_adicionais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage company produto_grupos" ON public.produto_grupos_adicionais;
DROP POLICY IF EXISTS "Super admins manage all produto_grupos" ON public.produto_grupos_adicionais;
CREATE POLICY "Members manage company produto_grupos" ON public.produto_grupos_adicionais FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND p.company_id = get_user_company(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = produto_id AND p.company_id = get_user_company(auth.uid())));
CREATE POLICY "Super admins manage all produto_grupos" ON public.produto_grupos_adicionais FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage company combos" ON public.combos;
DROP POLICY IF EXISTS "Super admins manage all combos" ON public.combos;
CREATE POLICY "Members manage company combos" ON public.combos FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid())) WITH CHECK (company_id = get_user_company(auth.uid()));
CREATE POLICY "Super admins manage all combos" ON public.combos FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.combo_itens (
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  PRIMARY KEY (combo_id, produto_id)
);
ALTER TABLE public.combo_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage company combo_itens" ON public.combo_itens;
DROP POLICY IF EXISTS "Super admins manage all combo_itens" ON public.combo_itens;
CREATE POLICY "Members manage company combo_itens" ON public.combo_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.combos c WHERE c.id = combo_id AND c.company_id = get_user_company(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.combos c WHERE c.id = combo_id AND c.company_id = get_user_company(auth.uid())));
CREATE POLICY "Super admins manage all combo_itens" ON public.combo_itens FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.mesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  numero text NOT NULL,
  capacidade int NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'livre',
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage company mesas" ON public.mesas;
DROP POLICY IF EXISTS "Super admins manage all mesas" ON public.mesas;
CREATE POLICY "Members manage company mesas" ON public.mesas FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid())) WITH CHECK (company_id = get_user_company(auth.uid()));
CREATE POLICY "Super admins manage all mesas" ON public.mesas FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
DROP TRIGGER IF EXISTS trg_mesas_updated ON public.mesas;
CREATE TRIGGER trg_mesas_updated BEFORE UPDATE ON public.mesas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS available boolean NOT NULL DEFAULT true;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'salao',
  ADD COLUMN IF NOT EXISTS mesa_id uuid,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.pedidos ALTER COLUMN client_id DROP NOT NULL;

-- Drop old check constraint, migrate data, add new check
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;

UPDATE public.pedidos SET status = CASE
  WHEN status = 'pending' THEN 'novo'
  WHEN status = 'processing' THEN 'preparo'
  WHEN status = 'completed' THEN 'pago'
  WHEN status = 'cancelled' THEN 'cancelado'
  ELSE status
END;

ALTER TABLE public.pedidos ALTER COLUMN status SET DEFAULT 'novo';
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_status_check
  CHECK (status IN ('novo','preparo','pronto','pago','cancelado'));
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_canal_check
  CHECK (canal IN ('salao','balcao','retirada','delivery','whatsapp'));
ALTER TABLE public.mesas ADD CONSTRAINT mesas_status_check
  CHECK (status IN ('livre','ocupada','conta'));
