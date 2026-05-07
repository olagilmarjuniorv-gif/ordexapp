
-- Roles enum
create type public.app_role as enum ('admin', 'vendedor');

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles table (separate to prevent privilege escalation)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Security definer role checker
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Profiles policies
create policy "Users view own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "Admins view all profiles" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- user_roles policies
create policy "Users view own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins view all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone'
  );
  insert into public.user_roles (user_id, role)
  values (new.id, 'vendedor');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
