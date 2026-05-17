
CREATE TABLE public.integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  provider text NOT NULL,
  merchant_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'desconectado',
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);

ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all integracoes"
  ON public.integracoes FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Company admins manage company integracoes"
  ON public.integracoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company(auth.uid()));

CREATE TRIGGER integracoes_touch BEFORE UPDATE ON public.integracoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.integracao_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.integracoes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_integracao_logs_integration ON public.integracao_logs(integration_id, created_at DESC);

ALTER TABLE public.integracao_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view all integracao_logs"
  ON public.integracao_logs FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Company admins view company integracao_logs"
  ON public.integracao_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company(auth.uid()));

ALTER TABLE public.pedidos
  ADD COLUMN external_provider text,
  ADD COLUMN external_order_id text,
  ADD COLUMN external_payload jsonb,
  ADD COLUMN imported_at timestamptz;

CREATE UNIQUE INDEX idx_pedidos_external_unique
  ON public.pedidos(company_id, external_provider, external_order_id)
  WHERE external_provider IS NOT NULL AND external_order_id IS NOT NULL;
