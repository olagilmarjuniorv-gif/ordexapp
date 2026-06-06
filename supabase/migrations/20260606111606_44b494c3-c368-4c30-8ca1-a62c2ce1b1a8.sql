-- Trigger: ao criar uma nova empresa, cria automaticamente a assinatura de Trial (BASE, 14 dias)
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_subscriptions (
    company_id, plano, status, ciclo, inicio, vencimento,
    limite_pedidos_mes, limite_conversas_mes, limite_usuarios, valor
  ) VALUES (
    NEW.id, 'base', 'trial', 'mensal',
    now(), (now() + interval '14 days')::date,
    300, 300, 1, 0
  )
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_trial_subscription ON public.companies;
CREATE TRIGGER trg_create_trial_subscription
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.create_trial_subscription();

-- Backfill: empresas que ainda não têm assinatura entram em Trial de 14 dias a partir de agora
INSERT INTO public.company_subscriptions (
  company_id, plano, status, ciclo, inicio, vencimento,
  limite_pedidos_mes, limite_conversas_mes, limite_usuarios, valor
)
SELECT c.id, 'base', 'trial', 'mensal',
       now(), (now() + interval '14 days')::date,
       300, 300, 1, 0
FROM public.companies c
LEFT JOIN public.company_subscriptions s ON s.company_id = c.id
WHERE s.id IS NULL
ON CONFLICT (company_id) DO NOTHING;