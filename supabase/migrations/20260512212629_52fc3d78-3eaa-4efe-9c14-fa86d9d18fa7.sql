-- 1. Add cozinha role to enum (vendedor/entregador permanecem no enum por compat, não usados)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cozinha';

-- 2. Migrar qualquer vendedor restante para atendente
UPDATE public.user_roles SET role = 'atendente' WHERE role = 'vendedor';

-- 3. last_login_at no profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 4. audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  user_id uuid,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created
  ON public.audit_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON public.audit_logs (user_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins view all audit_logs" ON public.audit_logs;
CREATE POLICY "Super admins view all audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Company admins view company audit_logs" ON public.audit_logs;
CREATE POLICY "Company admins view company audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND company_id = public.get_user_company(auth.uid())
  );

-- INSERT/UPDATE/DELETE: apenas via service role (server functions). Nenhuma policy de write.

-- 5. Helper function para registrar log (chamada pelo backend via service role, mas pode ser usada como SECURITY DEFINER se necessário no futuro)
CREATE OR REPLACE FUNCTION public.log_event(
  _company_id uuid,
  _user_id uuid,
  _user_name text,
  _action text,
  _entity_type text,
  _entity_id text,
  _description text,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, entity_type, entity_id, description, metadata)
  VALUES (_company_id, _user_id, _user_name, _action, _entity_type, _entity_id, _description, _metadata);
END;
$$;