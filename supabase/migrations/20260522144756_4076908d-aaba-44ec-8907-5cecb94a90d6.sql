-- whatsapp_conexoes
CREATE TABLE public.whatsapp_conexoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'desconectado',
  phone_number text,
  whatsapp_business_id text,
  access_token text,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_conexoes_status_check CHECK (status IN ('conectado','desconectado','sincronizando','erro'))
);

CREATE INDEX idx_whatsapp_conexoes_company ON public.whatsapp_conexoes(company_id);

ALTER TABLE public.whatsapp_conexoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all whatsapp_conexoes"
  ON public.whatsapp_conexoes FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Company admins manage company whatsapp_conexoes"
  ON public.whatsapp_conexoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Members view company whatsapp_conexoes"
  ON public.whatsapp_conexoes FOR SELECT TO authenticated
  USING (company_id = get_user_company(auth.uid()));

CREATE TRIGGER trg_whatsapp_conexoes_touch
  BEFORE UPDATE ON public.whatsapp_conexoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- whatsapp_conversas
CREATE TABLE public.whatsapp_conversas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  conexao_id uuid NOT NULL REFERENCES public.whatsapp_conexoes(id) ON DELETE CASCADE,
  customer_name text,
  customer_phone text NOT NULL,
  last_message text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_conversas_company ON public.whatsapp_conversas(company_id);
CREATE INDEX idx_whatsapp_conversas_conexao ON public.whatsapp_conversas(conexao_id);
CREATE UNIQUE INDEX uniq_whatsapp_conversa_phone ON public.whatsapp_conversas(conexao_id, customer_phone);

ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all whatsapp_conversas"
  ON public.whatsapp_conversas FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Members manage company whatsapp_conversas"
  ON public.whatsapp_conversas FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid()))
  WITH CHECK (company_id = get_user_company(auth.uid()));

CREATE TRIGGER trg_whatsapp_conversas_touch
  BEFORE UPDATE ON public.whatsapp_conversas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- whatsapp_mensagens
CREATE TABLE public.whatsapp_mensagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  conversa_id uuid NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  direction text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  content text NOT NULL DEFAULT '',
  external_message_id text,
  status text NOT NULL DEFAULT 'pending',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_mensagens_direction_check CHECK (direction IN ('inbound','outbound'))
);

CREATE INDEX idx_whatsapp_mensagens_company ON public.whatsapp_mensagens(company_id);
CREATE INDEX idx_whatsapp_mensagens_conversa ON public.whatsapp_mensagens(conversa_id, created_at DESC);

ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all whatsapp_mensagens"
  ON public.whatsapp_mensagens FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Members manage company whatsapp_mensagens"
  ON public.whatsapp_mensagens FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid()))
  WITH CHECK (company_id = get_user_company(auth.uid()));