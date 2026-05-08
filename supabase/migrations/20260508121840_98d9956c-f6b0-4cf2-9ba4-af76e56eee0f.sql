
-- Companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER companies_touch_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Add company_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_company(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_company(uuid) FROM anon, authenticated;

-- Companies RLS
CREATE POLICY "Super admins manage companies"
  ON public.companies FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Members view own company"
  ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_user_company(auth.uid()));

-- Replace profiles RLS for admin scope
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;

CREATE POLICY "Super admins view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Company admins view company profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND company_id IS NOT NULL
    AND company_id = public.get_user_company(auth.uid())
  );

CREATE POLICY "Company admins update company profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND company_id IS NOT NULL
    AND company_id = public.get_user_company(auth.uid())
  );

-- Replace user_roles RLS
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;

CREATE POLICY "Super admins manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company admins view company roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND public.get_user_company(auth.uid()) IS NOT NULL
    AND public.get_user_company(user_id) = public.get_user_company(auth.uid())
  );

CREATE POLICY "Company admins manage company roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND role <> 'super_admin'
    AND public.get_user_company(auth.uid()) IS NOT NULL
    AND public.get_user_company(user_id) = public.get_user_company(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND role <> 'super_admin'
    AND public.get_user_company(auth.uid()) IS NOT NULL
    AND public.get_user_company(user_id) = public.get_user_company(auth.uid())
  );
