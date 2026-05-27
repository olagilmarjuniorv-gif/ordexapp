-- Restaurar EXECUTE para 'authenticated' nas funções helper SECURITY DEFINER.
-- Elas são usadas dentro das RLS policies (profiles, companies, categorias, pedidos, etc.)
-- e a revogação anterior estava quebrando a leitura do próprio profile/company.
-- A segurança continua garantida porque são SECURITY DEFINER com search_path fixo
-- e apenas retornam booleano/uuid sem expor dados de outras empresas.

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company(uuid) TO authenticated;

-- Endurecer: impedir que um usuário consulte papéis/empresa de OUTRO usuário.
-- As funções ainda recebem _user_id mas só respondem com dados se for o próprio
-- usuário ou se quem chama for super_admin. Mantém compatibilidade com auth.uid().
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (
        _user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.user_roles ur2 WHERE ur2.user_id = auth.uid() AND ur2.role = 'super_admin')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_company(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT company_id FROM public.profiles
  WHERE id = _user_id
    AND (
      _user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
    )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
      AND (
        _user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.user_roles ur2 WHERE ur2.user_id = auth.uid() AND ur2.role = 'super_admin')
      )
  )
$$;