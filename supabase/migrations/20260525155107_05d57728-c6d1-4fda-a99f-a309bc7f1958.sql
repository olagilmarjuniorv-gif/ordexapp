
-- whatsapp_sessoes
CREATE TABLE public.whatsapp_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  conexao_id uuid,
  customer_phone text NOT NULL,
  estado_atual text NOT NULL DEFAULT 'aguardando_inicio',
  carrinho jsonb NOT NULL DEFAULT '[]'::jsonb,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  atendente_assumiu boolean NOT NULL DEFAULT false,
  last_event_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, customer_phone)
);

CREATE INDEX idx_whatsapp_sessoes_company ON public.whatsapp_sessoes(company_id);
CREATE INDEX idx_whatsapp_sessoes_last_event ON public.whatsapp_sessoes(last_event_at);

ALTER TABLE public.whatsapp_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage company whatsapp_sessoes"
  ON public.whatsapp_sessoes FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid()))
  WITH CHECK (company_id = get_user_company(auth.uid()));

CREATE POLICY "Super admins manage all whatsapp_sessoes"
  ON public.whatsapp_sessoes FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_whatsapp_sessoes_touch
  BEFORE UPDATE ON public.whatsapp_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- whatsapp_carrinhos
CREATE TABLE public.whatsapp_carrinhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  sessao_id uuid NOT NULL REFERENCES public.whatsapp_sessoes(id) ON DELETE CASCADE,
  pedido_id uuid,
  status text NOT NULL DEFAULT 'aberto',
  valor_total numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_carrinhos_company ON public.whatsapp_carrinhos(company_id);
CREATE INDEX idx_whatsapp_carrinhos_sessao ON public.whatsapp_carrinhos(sessao_id);

ALTER TABLE public.whatsapp_carrinhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage company whatsapp_carrinhos"
  ON public.whatsapp_carrinhos FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid()))
  WITH CHECK (company_id = get_user_company(auth.uid()));

CREATE POLICY "Super admins manage all whatsapp_carrinhos"
  ON public.whatsapp_carrinhos FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_whatsapp_carrinhos_touch
  BEFORE UPDATE ON public.whatsapp_carrinhos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- whatsapp_carrinho_itens
CREATE TABLE public.whatsapp_carrinho_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrinho_id uuid NOT NULL REFERENCES public.whatsapp_carrinhos(id) ON DELETE CASCADE,
  produto_id uuid,
  nome text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_carrinho_itens_carrinho ON public.whatsapp_carrinho_itens(carrinho_id);

ALTER TABLE public.whatsapp_carrinho_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage company whatsapp_carrinho_itens"
  ON public.whatsapp_carrinho_itens FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.whatsapp_carrinhos c
    WHERE c.id = whatsapp_carrinho_itens.carrinho_id
      AND c.company_id = get_user_company(auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.whatsapp_carrinhos c
    WHERE c.id = whatsapp_carrinho_itens.carrinho_id
      AND c.company_id = get_user_company(auth.uid())
  ));

CREATE POLICY "Super admins manage all whatsapp_carrinho_itens"
  ON public.whatsapp_carrinho_itens FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- whatsapp_fluxos
CREATE TABLE public.whatsapp_fluxos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  mensagem_boas_vindas text NOT NULL DEFAULT 'Olá! Seja bem-vindo. Digite *menu* para ver nosso cardápio.',
  mensagem_fechamento text NOT NULL DEFAULT 'Obrigado pelo seu pedido! Volte sempre.',
  mensagem_sem_atendimento text NOT NULL DEFAULT 'No momento nenhum atendente está disponível. Em breve responderemos.',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_fluxos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage company whatsapp_fluxos"
  ON public.whatsapp_fluxos FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid()))
  WITH CHECK (company_id = get_user_company(auth.uid()));

CREATE POLICY "Super admins manage all whatsapp_fluxos"
  ON public.whatsapp_fluxos FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_whatsapp_fluxos_touch
  BEFORE UPDATE ON public.whatsapp_fluxos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_sessoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;
