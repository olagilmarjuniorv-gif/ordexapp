import { createFileRoute, Navigate, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { recordLogin } from "@/lib/audit.functions";

export const Route = createFileRoute("/_app")({
  component: Guard,
});

// Rotas proibidas por role
const ATENDENTE_BLOCKED = ["/cozinha", "/empresas", "/usuarios", "/historico", "/produtos", "/categorias", "/adicionais", "/combos", "/mensagens"];
const COZINHA_ALLOWED_PREFIX = "/cozinha";

function Guard() {
  const { session, loading, profile, role, isAtendente, isCozinha } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const recordLoginFn = useServerFn(recordLogin);

  useEffect(() => {
    if (profile && profile.active === false) {
      toast.error("Sua conta foi desativada");
      supabase.auth.signOut();
    }
  }, [profile]);

  // Registrar login uma vez por sessão
  useEffect(() => {
    if (!session || !role) return;
    const key = `ordex.lastLoginRecorded.${session.user.id}`;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(key) === "1") return;
    recordLoginFn({}).then(() => sessionStorage.setItem(key, "1")).catch(() => {});
  }, [session, role, recordLoginFn]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" />;

  // Guard por role
  if (isCozinha && !path.startsWith(COZINHA_ALLOWED_PREFIX)) {
    return <Navigate to="/cozinha" />;
  }
  if (isAtendente && ATENDENTE_BLOCKED.some((b) => path.startsWith(b))) {
    return <Navigate to="/pedidos" />;
  }

  return <AppLayout />;
}
