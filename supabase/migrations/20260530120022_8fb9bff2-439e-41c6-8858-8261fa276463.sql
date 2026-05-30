-- Add operational state column for per-channel sub-steps (post-ready expedition phases)
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS fase_canal text;

-- Update validation trigger to allow 'finalizado' as operational status
-- The previous version only validated forma_pagamento and status_financeiro; we now
-- also enforce a guard list for status so 'finalizado' is accepted and typos are caught.
CREATE OR REPLACE FUNCTION public.validate_pedido_pagamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('novo','preparo','pronto','finalizado','pago','cancelado') THEN
    RAISE EXCEPTION 'status inválido: %', NEW.status;
  END IF;

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
$function$;

-- Update pagar_mesa to use 'finalizado' for operational status and set status_financeiro = 'pago'
CREATE OR REPLACE FUNCTION public.pagar_mesa(_mesa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
  _caller_company uuid;
BEGIN
  SELECT company_id INTO _company_id FROM public.mesas WHERE id = _mesa_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Mesa não encontrada';
  END IF;

  IF NOT public.is_super_admin(auth.uid()) THEN
    _caller_company := public.get_user_company(auth.uid());
    IF _caller_company IS NULL OR _caller_company <> _company_id THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
  END IF;

  UPDATE public.pedidos
    SET status = 'finalizado',
        status_financeiro = 'pago',
        paid_at = now()
    WHERE mesa_id = _mesa_id
      AND status NOT IN ('finalizado', 'pago', 'cancelado');

  UPDATE public.mesas
    SET status = 'livre', opened_at = NULL
    WHERE id = _mesa_id;
END;
$function$;