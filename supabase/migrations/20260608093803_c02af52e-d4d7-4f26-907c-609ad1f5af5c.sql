-- ============ 1. company_subscriptions: campos de gateway / valores ============
ALTER TABLE public.company_subscriptions
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS customer_id text,
  ADD COLUMN IF NOT EXISTS subscription_id text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS external_status text,
  ADD COLUMN IF NOT EXISTS external_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS valor_mensal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_anual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_anual_pct numeric NOT NULL DEFAULT 0;

-- ============ 2. planos_catalogo ============
CREATE TABLE IF NOT EXISTS public.planos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  limite_pedidos_mes integer NOT NULL DEFAULT 0,
  limite_conversas_mes integer NOT NULL DEFAULT 0,
  limite_usuarios integer NOT NULL DEFAULT 0,
  valor_mensal numeric NOT NULL DEFAULT 0,
  valor_anual numeric NOT NULL DEFAULT 0,
  desconto_anual_pct numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.planos_catalogo TO authenticated;
GRANT ALL ON public.planos_catalogo TO service_role;

ALTER TABLE public.planos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planos_catalogo_select_authenticated"
  ON public.planos_catalogo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "planos_catalogo_super_admin_all"
  ON public.planos_catalogo FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_planos_catalogo_updated_at
  BEFORE UPDATE ON public.planos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.planos_catalogo (codigo, nome, limite_pedidos_mes, limite_conversas_mes, limite_usuarios, ordem)
VALUES
  ('base', 'Base', 300, 300, 1, 1),
  ('pro', 'Pro', 1500, 1500, 3, 2),
  ('max', 'Max', 0, 3000, 8, 3)
ON CONFLICT (codigo) DO NOTHING;

-- ============ 3. cobrancas (histórico futuro) ============
CREATE TABLE IF NOT EXISTS public.cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.company_subscriptions(id) ON DELETE SET NULL,
  gateway text,
  external_id text,
  ciclo text,
  valor numeric NOT NULL DEFAULT 0,
  vencimento date,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pendente',
  payment_method text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobrancas_company ON public.cobrancas(company_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_subscription ON public.cobrancas(subscription_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON public.cobrancas(status);

GRANT SELECT ON public.cobrancas TO authenticated;
GRANT ALL ON public.cobrancas TO service_role;

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cobrancas_super_admin_all"
  ON public.cobrancas FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "cobrancas_company_admin_select"
  ON public.cobrancas FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND company_id = public.get_user_company(auth.uid())
  );

CREATE TRIGGER trg_cobrancas_updated_at
  BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();