ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_status_check
  CHECK (status = ANY (ARRAY['novo'::text, 'preparo'::text, 'pronto'::text, 'finalizado'::text, 'pago'::text, 'cancelado'::text]));