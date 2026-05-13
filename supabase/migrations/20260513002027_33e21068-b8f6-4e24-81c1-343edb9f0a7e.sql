ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_mesa_id_fkey FOREIGN KEY (mesa_id) REFERENCES public.mesas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa ON public.pedidos(mesa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_user ON public.pedidos(user_id);