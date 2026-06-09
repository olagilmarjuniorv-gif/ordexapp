CREATE TABLE public.asaas_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event text NOT NULL,
  payment_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asaas_webhook_events_payment_id ON public.asaas_webhook_events(payment_id);
CREATE INDEX idx_asaas_webhook_events_event ON public.asaas_webhook_events(event);
CREATE INDEX idx_asaas_webhook_events_received_at ON public.asaas_webhook_events(received_at DESC);

GRANT ALL ON public.asaas_webhook_events TO service_role;

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asaas_webhook_events_super_admin_select"
  ON public.asaas_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
