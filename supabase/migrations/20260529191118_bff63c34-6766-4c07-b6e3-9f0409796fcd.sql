-- 1) Companies: payment configuration
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS pagamento_metodos jsonb NOT NULL DEFAULT jsonb_build_object(
    'pix_online', false,
    'dinheiro', true,
    'credito_presencial', true,
    'debito_presencial', true,
    'pix_presencial', true,
    'pagamento_entrega', true,
    'pagamento_retirada', true
  ),
  ADD COLUMN IF NOT EXISTS exigir_pagamento_antes_cozinha boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permitir_pagamento_entrega boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permitir_pagamento_retirada boolean NOT NULL DEFAULT true;

-- 2) Pedidos: financial fields (operational status remains in `status`)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS status_financeiro text NOT NULL DEFAULT 'aguardando_pagamento';

-- Validation trigger: forma_pagamento and status_financeiro values
CREATE OR REPLACE FUNCTION public.validate_pedido_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.forma_pagamento IS NOT NULL AND NEW.forma_pagamento NOT IN (
    'pix_online','dinheiro','credito_presencial','debito_presencial',
    'pix_presencial','pagamento_entrega','pagamento_retirada'
  ) THEN
    RAISE EXCEPTION 'forma_pagamento inválida: %', NEW.forma_pagamento;
  END IF;

  IF NEW.status_financeiro NOT IN (
    'aguardando_pagamento','pago','pagamento_entrega','pagamento_retirada','cancelado'
  ) THEN
    RAISE EXCEPTION 'status_financeiro inválido: %', NEW.status_financeiro;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pedido_pagamento ON public.pedidos;
CREATE TRIGGER trg_validate_pedido_pagamento
  BEFORE INSERT OR UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.validate_pedido_pagamento();

-- Backfill legacy "pago" status into status_financeiro for consistency
UPDATE public.pedidos
   SET status_financeiro = 'pago'
 WHERE status = 'pago' AND status_financeiro = 'aguardando_pagamento';