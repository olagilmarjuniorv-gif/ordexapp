-- ===== FASE A: Atendente + Realtime + Comanda =====

-- 1) Migrar usuários vendedor → atendente (enum 'atendente' já existe)
UPDATE public.user_roles SET role = 'atendente' WHERE role = 'vendedor';

-- 2) Atualizar handle_new_user para não atribuir mais 'vendedor' por padrão
-- (não cria role automática - admin atribui depois)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

-- 3) Realtime: garantir REPLICA IDENTITY FULL e adicionar à publication
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;
ALTER TABLE public.mesas REPLICA IDENTITY FULL;

-- Adicionar tabelas à publication (idempotente: ignora se já existir)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 4) Função RPC para pagar mesa atomicamente
-- Marca todos os pedidos ativos da mesa como pagos e libera a mesa
CREATE OR REPLACE FUNCTION public.pagar_mesa(_mesa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _caller_company uuid;
BEGIN
  SELECT company_id INTO _company_id FROM public.mesas WHERE id = _mesa_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Mesa não encontrada';
  END IF;

  -- Verificar tenant
  IF NOT public.is_super_admin(auth.uid()) THEN
    _caller_company := public.get_user_company(auth.uid());
    IF _caller_company IS NULL OR _caller_company <> _company_id THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
  END IF;

  UPDATE public.pedidos
    SET status = 'pago', paid_at = now()
    WHERE mesa_id = _mesa_id
      AND status NOT IN ('pago', 'cancelado');

  UPDATE public.mesas
    SET status = 'livre', opened_at = NULL
    WHERE id = _mesa_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pagar_mesa(uuid) TO authenticated;