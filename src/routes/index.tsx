import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
  head: () => ({
    meta: [
      { title: "ORDEX — Sistema operacional para hamburguerias e deliverys" },
      { name: "description", content: "Centralize pedidos do salão, balcão, retirada, delivery e WhatsApp em tempo real, com cozinha integrada e operação rápida." },
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
