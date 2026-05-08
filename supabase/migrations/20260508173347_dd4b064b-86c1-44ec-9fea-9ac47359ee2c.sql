
-- CLIENTES
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_clientes_company on public.clientes(company_id);
alter table public.clientes enable row level security;

create policy "Members manage company clientes"
  on public.clientes for all to authenticated
  using (company_id = public.get_user_company(auth.uid()))
  with check (company_id = public.get_user_company(auth.uid()));
create policy "Super admins manage all clientes"
  on public.clientes for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create trigger trg_clientes_updated before update on public.clientes
  for each row execute function public.touch_updated_at();

-- PRODUTOS
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12,2) not null default 0,
  stock numeric(12,2) not null default 0,
  "minStock" numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_produtos_company on public.produtos(company_id);
alter table public.produtos enable row level security;

create policy "Members manage company produtos"
  on public.produtos for all to authenticated
  using (company_id = public.get_user_company(auth.uid()))
  with check (company_id = public.get_user_company(auth.uid()));
create policy "Super admins manage all produtos"
  on public.produtos for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create trigger trg_produtos_updated before update on public.produtos
  for each row execute function public.touch_updated_at();

-- ORCAMENTOS
create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  client_id uuid not null references public.clientes(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','sent','approved','rejected')),
  total_amount numeric(12,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_orcamentos_company on public.orcamentos(company_id);
create index idx_orcamentos_client on public.orcamentos(client_id);
alter table public.orcamentos enable row level security;

create policy "Members manage company orcamentos"
  on public.orcamentos for all to authenticated
  using (company_id = public.get_user_company(auth.uid()))
  with check (company_id = public.get_user_company(auth.uid()));
create policy "Super admins manage all orcamentos"
  on public.orcamentos for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create trigger trg_orcamentos_updated before update on public.orcamentos
  for each row execute function public.touch_updated_at();

-- PEDIDOS
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  client_id uuid not null references public.clientes(id) on delete restrict,
  orcamento_id uuid references public.orcamentos(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','processing','completed','cancelled')),
  total_amount numeric(12,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_pedidos_company on public.pedidos(company_id);
create index idx_pedidos_client on public.pedidos(client_id);
alter table public.pedidos enable row level security;

create policy "Members manage company pedidos"
  on public.pedidos for all to authenticated
  using (company_id = public.get_user_company(auth.uid()))
  with check (company_id = public.get_user_company(auth.uid()));
create policy "Super admins manage all pedidos"
  on public.pedidos for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create trigger trg_pedidos_updated before update on public.pedidos
  for each row execute function public.touch_updated_at();
