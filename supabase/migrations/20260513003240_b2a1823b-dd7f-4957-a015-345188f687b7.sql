CREATE TABLE public.mensagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  cliente_id uuid,
  pedido_id uuid,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_mensagens_company ON public.mensagens(company_id, created_at DESC);
CREATE INDEX idx_mensagens_cliente ON public.mensagens(cliente_id);
CREATE INDEX idx_mensagens_pedido ON public.mensagens(pedido_id);

ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage company mensagens"
ON public.mensagens FOR ALL TO authenticated
USING (company_id = public.get_user_company(auth.uid()))
WITH CHECK (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Super admins manage all mensagens"
ON public.mensagens FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));