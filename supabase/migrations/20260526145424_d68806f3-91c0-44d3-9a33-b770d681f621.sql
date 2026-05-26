-- 1) WhatsApp conexões: somente admins leem (remove leitura de membros)
DROP POLICY IF EXISTS "Members view company whatsapp_conexoes" ON public.whatsapp_conexoes;

CREATE POLICY "Company admins view company whatsapp_conexoes"
ON public.whatsapp_conexoes
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) AND company_id = public.get_user_company(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- 2) Storage bucket "produtos": escopo por empresa em path prefix
-- Convenção: objetos devem ser salvos como "{company_id}/..."
DROP POLICY IF EXISTS "Authenticated upload produtos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update produtos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete produtos" ON storage.objects;
DROP POLICY IF EXISTS "Public read produtos bucket" ON storage.objects;

-- Leitura pública individual (CDN URL); listagem requer SELECT RLS — não daremos broad SELECT.
-- Mantemos SELECT só para membros da empresa dona, para listagem autenticada.
CREATE POLICY "Members read own company produtos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'produtos'
  AND (storage.foldername(name))[1] = public.get_user_company(auth.uid())::text
);

CREATE POLICY "Members upload own company produtos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'produtos'
  AND (storage.foldername(name))[1] = public.get_user_company(auth.uid())::text
);

CREATE POLICY "Members update own company produtos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'produtos'
  AND (storage.foldername(name))[1] = public.get_user_company(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'produtos'
  AND (storage.foldername(name))[1] = public.get_user_company(auth.uid())::text
);

CREATE POLICY "Members delete own company produtos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'produtos'
  AND (storage.foldername(name))[1] = public.get_user_company(auth.uid())::text
);

-- Super admin acesso total
CREATE POLICY "Super admins manage produtos bucket"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'produtos' AND public.is_super_admin(auth.uid()))
WITH CHECK (bucket_id = 'produtos' AND public.is_super_admin(auth.uid()));

-- 3) Realtime: exigir autenticação para subscrever no canal
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

-- 4) SECURITY DEFINER: revogar execução de roles não autorizadas
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_company(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_event(uuid, uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_categorias() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pagar_mesa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pagar_mesa(uuid) TO authenticated;