CREATE TABLE public.subscription_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plano text NOT NULL CHECK (plano IN ('base','pro','max')),
  ciclo text NOT NULL CHECK (ciclo IN ('mensal','anual')),
  status text NOT NULL DEFAULT 'aguardando_pagamento' CHECK (status IN ('aguardando_pagamento','pago','cancelado','expirado')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscription_intents_company_id_idx ON public.subscription_intents(company_id);
CREATE INDEX subscription_intents_status_idx ON public.subscription_intents(status);

GRANT SELECT, INSERT, UPDATE ON public.subscription_intents TO authenticated;
GRANT ALL ON public.subscription_intents TO service_role;

ALTER TABLE public.subscription_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own intents"
  ON public.subscription_intents FOR SELECT TO authenticated
  USING (company_id = public.get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins insert own intents"
  ON public.subscription_intents FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins manage intents"
  ON public.subscription_intents FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_subscription_intents_updated_at
  BEFORE UPDATE ON public.subscription_intents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();