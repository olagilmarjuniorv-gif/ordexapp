
-- Tickets de suporte SaaS
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'duvida',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'aberto',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_company ON public.tickets(company_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all tickets"
  ON public.tickets FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Company admins manage company tickets"
  ON public.tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company(auth.uid()));

-- Mensagens dentro do ticket
CREATE TABLE public.ticket_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_role text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_msgs_ticket ON public.ticket_mensagens(ticket_id);

ALTER TABLE public.ticket_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all ticket msgs"
  ON public.ticket_mensagens FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Company admins manage company ticket msgs"
  ON public.ticket_mensagens FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_mensagens.ticket_id
        AND t.company_id = get_user_company(auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_mensagens.ticket_id
        AND t.company_id = get_user_company(auth.uid())
    )
  );
