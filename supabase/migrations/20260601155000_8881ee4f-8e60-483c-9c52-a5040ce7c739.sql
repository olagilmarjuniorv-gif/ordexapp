
-- 1) Expandir companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS email_financeiro text,
  ADD COLUMN IF NOT EXISTS email_operacional text,
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_cpf text,
  ADD COLUMN IF NOT EXISTS responsavel_telefone text,
  ADD COLUMN IF NOT EXISTS nome_publico text,
  ADD COLUMN IF NOT EXISTS telefone_publico text,
  ADD COLUMN IF NOT EXISTS endereco_publico text,
  ADD COLUMN IF NOT EXISTS tempo_entrega_min integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS raio_entrega_km numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canais_ativos jsonb NOT NULL DEFAULT
    '{"whatsapp":true,"balcao":true,"mesa":true,"delivery":true,"ifood":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS mensagens_operacionais jsonb NOT NULL DEFAULT
    '{"loja_fechada":"","recebido":"","preparo":"","pronto":"","finalizado":""}'::jsonb;

-- 2) Assinaturas (1 por empresa)
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL UNIQUE,
  plano text NOT NULL DEFAULT 'base',
  ciclo text NOT NULL DEFAULT 'mensal',
  status text NOT NULL DEFAULT 'ativa',
  proxima_cobranca date,
  valor numeric NOT NULL DEFAULT 0,
  limite_pedidos_mes integer NOT NULL DEFAULT 500,
  limite_conversas_mes integer NOT NULL DEFAULT 1000,
  limite_usuarios integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_subscriptions_plano_check CHECK (plano IN ('base','pro','max')),
  CONSTRAINT company_subscriptions_ciclo_check CHECK (ciclo IN ('mensal','anual')),
  CONSTRAINT company_subscriptions_status_check CHECK (status IN ('ativa','suspensa','cancelada','trial'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_subscriptions TO authenticated;
GRANT ALL ON public.company_subscriptions TO service_role;

ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own subscription"
  ON public.company_subscriptions FOR SELECT TO authenticated
  USING (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Super admins manage subscriptions"
  ON public.company_subscriptions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_company_subscriptions_updated_at
  BEFORE UPDATE ON public.company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Solicitações de privacidade
CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  tipo text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  solicitado_por uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT privacy_requests_tipo_check CHECK (tipo IN ('exportacao','encerramento')),
  CONSTRAINT privacy_requests_status_check CHECK (status IN ('pendente','em_andamento','concluida','rejeitada'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.privacy_requests TO authenticated;
GRANT ALL ON public.privacy_requests TO service_role;

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins manage company privacy_requests"
  ON public.privacy_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) AND company_id = public.get_user_company(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) AND company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Super admins manage all privacy_requests"
  ON public.privacy_requests FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
