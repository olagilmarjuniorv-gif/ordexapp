
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS rua text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS delivery_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS retirada_ativa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tempo_preparo_min integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS pedido_minimo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_entrega numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horarios jsonb NOT NULL DEFAULT '{
    "seg":{"abre":"18:00","fecha":"23:00","ativo":true},
    "ter":{"abre":"18:00","fecha":"23:00","ativo":true},
    "qua":{"abre":"18:00","fecha":"23:00","ativo":true},
    "qui":{"abre":"18:00","fecha":"23:00","ativo":true},
    "sex":{"abre":"18:00","fecha":"23:30","ativo":true},
    "sab":{"abre":"18:00","fecha":"23:30","ativo":true},
    "dom":{"abre":"18:00","fecha":"23:00","ativo":false}
  }'::jsonb;

-- Permite admins editarem a própria empresa (super_admin já tem policy ALL)
DROP POLICY IF EXISTS "Company admins update own company" ON public.companies;
CREATE POLICY "Company admins update own company"
ON public.companies
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND id = get_user_company(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND id = get_user_company(auth.uid()));
