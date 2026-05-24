ALTER TABLE public.whatsapp_conexoes
  ADD COLUMN IF NOT EXISTS phone_number_id text;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conexoes_phone_number_id_unique
  ON public.whatsapp_conexoes (phone_number_id)
  WHERE phone_number_id IS NOT NULL;