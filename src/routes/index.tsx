import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
  head: () => ({
    meta: [
      { title: "ObraGestor — Gestão para lojas de material de construção" },
      { name: "description", content: "Sistema simples e rápido para orçamentos, pedidos e entregas em lojas de material de construção." },
    ],
  }),
});

function IndexRedirect() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <Navigate to={session ? "/dashboard" : "/login"} />;
}
