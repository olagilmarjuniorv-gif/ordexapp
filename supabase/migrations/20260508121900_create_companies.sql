
CREATE TABLE IF NOT EXISTS companies (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    slug text NOT NULL,
    phone text,
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT companies_pkey PRIMARY KEY (id),
    CONSTRAINT companies_slug_key UNIQUE (slug)
);

-- Enable RLS
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.companies'::regclass) THEN
    ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
  END IF;
END;
$$;

-- create policies for companies
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polname = 'Allow super_admins to manage companies' AND polrelid = 'public.companies'::regclass) THEN
    CREATE POLICY "Allow super_admins to manage companies" ON public.companies FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'
    ));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polname = 'Allow company members to view their company' AND polrelid = 'public.companies'::regclass) THEN
    CREATE POLICY "Allow company members to view their company" ON public.companies FOR SELECT
    USING (EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.company_id = id
    ));
  END IF;
END;
$$;

-- Add company_id to profiles
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='company_id') THEN
    ALTER TABLE public.profiles ADD COLUMN company_id uuid;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='profiles_company_id_fkey' AND conrelid='public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END;
$$;
