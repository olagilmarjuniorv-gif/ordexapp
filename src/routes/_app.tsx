import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({
  component: Guard,
});

function Guard() {
  const { session, loading, profile } = useAuth();

  useEffect(() => {
    if (profile && profile.active === false) {
      toast.error("Sua conta foi desativada");
      supabase.auth.signOut();
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" />;
  return <AppLayout />;
}
