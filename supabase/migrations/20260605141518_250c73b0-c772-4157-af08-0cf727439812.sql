
-- Normalize legacy status
UPDATE public.company_subscriptions SET status = 'ativo' WHERE status = 'ativa';

-- New columns
ALTER TABLE public.company_subscriptions
  ADD COLUMN IF NOT EXISTS inicio timestamptz,
  ADD COLUMN IF NOT EXISTS vencimento date;

-- Defaults for new rows (BASE plan)
ALTER TABLE public.company_subscriptions
  ALTER COLUMN limite_pedidos_mes SET DEFAULT 300,
  ALTER COLUMN limite_conversas_mes SET DEFAULT 300,
  ALTER COLUMN limite_usuarios SET DEFAULT 1,
  ALTER COLUMN status SET DEFAULT 'ativo';

-- Backfill BASE rows to current product limits (only rows still on legacy defaults)
UPDATE public.company_subscriptions
  SET limite_pedidos_mes = 300
  WHERE plano = 'base' AND limite_pedidos_mes = 500;
UPDATE public.company_subscriptions
  SET limite_conversas_mes = 300
  WHERE plano = 'base' AND limite_conversas_mes = 1000;
UPDATE public.company_subscriptions
  SET limite_usuarios = 1
  WHERE plano = 'base' AND limite_usuarios = 3;

-- Unique constraint: 1 subscription per company
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_subscriptions_company_id_key'
  ) THEN
    ALTER TABLE public.company_subscriptions
      ADD CONSTRAINT company_subscriptions_company_id_key UNIQUE (company_id);
  END IF;
END $$;

-- CHECK constraints
ALTER TABLE public.company_subscriptions
  DROP CONSTRAINT IF EXISTS company_subscriptions_plano_check,
  DROP CONSTRAINT IF EXISTS company_subscriptions_ciclo_check,
  DROP CONSTRAINT IF EXISTS company_subscriptions_status_check;

ALTER TABLE public.company_subscriptions
  ADD CONSTRAINT company_subscriptions_plano_check
    CHECK (plano IN ('base','pro','max')),
  ADD CONSTRAINT company_subscriptions_ciclo_check
    CHECK (ciclo IN ('mensal','anual')),
  ADD CONSTRAINT company_subscriptions_status_check
    CHECK (status IN ('trial','ativo','pendente','inadimplente','cancelado','expirado'));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_company_subscriptions_updated_at ON public.company_subscriptions;
CREATE TRIGGER trg_company_subscriptions_updated_at
  BEFORE UPDATE ON public.company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
