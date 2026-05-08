
-- Create clientes table
CREATE TABLE public.clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  CONSTRAINT clientes_pkey PRIMARY KEY (id),
  CONSTRAINT clientes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can manage all clientes" ON public.clientes FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Company members can manage own clientes" ON public.clientes FOR ALL USING (company_id = public.get_user_company(auth.uid())) WITH CHECK (company_id = public.get_user_company(auth.uid()));

-- Create produtos table
CREATE TABLE public.produtos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT produtos_pkey PRIMARY KEY (id),
  CONSTRAINT produtos_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can manage all produtos" ON public.produtos FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Company members can manage own produtos" ON public.produtos FOR ALL USING (company_id = public.get_user_company(auth.uid())) WITH CHECK (company_id = public.get_user_company(auth.uid()));

-- Create orcamentos table
CREATE TABLE public.orcamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL,
  client_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  valid_until date,
  total_amount numeric(10, 2),
  items jsonb,
  CONSTRAINT orcamentos_pkey PRIMARY KEY (id),
  CONSTRAINT orcamentos_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  CONSTRAINT orcamentos_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clientes(id) ON DELETE RESTRICT,
  CONSTRAINT orcamentos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can manage all orcamentos" ON public.orcamentos FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Company members can manage own orcamentos" ON public.orcamentos FOR ALL USING (company_id = public.get_user_company(auth.uid())) WITH CHECK (company_id = public.get_user_company(auth.uid()));

-- Create pedidos table
CREATE TABLE public.pedidos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL,
  orcamento_id uuid,
  client_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric(10, 2),
  items jsonb,
  CONSTRAINT pedidos_pkey PRIMARY KEY (id),
  CONSTRAINT pedidos_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  CONSTRAINT pedidos_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  CONSTRAINT pedidos_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clientes(id) ON DELETE RESTRICT,
  CONSTRAINT pedidos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can manage all pedidos" ON public.pedidos FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Company members can manage own pedidos" ON public.pedidos FOR ALL USING (company_id = public.get_user_company(auth.uid())) WITH CHECK (company_id = public.get_user_company(auth.uid()));
