import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { MensagensPanel } from "./mensagens";
import { ClientesPanel } from "./clientes";
import { HistoricoPanel } from "./historico";

export const Route = createFileRoute("/_app/atendimento")({
  component: AtendimentoPage,
  head: () => ({ meta: [{ title: "Atendimento — SaiuPedido" }] }),
});

function AtendimentoPage() {
  const { isAdmin, isSuperAdmin, isAtendente, isCozinha } = useAuth();

  const initialTab = (() => {
    if (typeof window === "undefined") return "conversas";
    return new URLSearchParams(window.location.search).get("tab") || "conversas";
  })();
  const [tab, setTab] = useState<string>(initialTab);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== tab) {
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  }, [tab]);

  if (isCozinha) return <Navigate to="/dashboard" />;
  if (!isAdmin && !isSuperAdmin && !isAtendente) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Atendimento</h1>
          <p className="text-sm text-muted-foreground">
            Conversas, clientes e histórico em um único lugar.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="conversas">Conversas</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="conversas">
          <MensagensPanel />
        </TabsContent>
        <TabsContent value="clientes">
          <ClientesPanel />
        </TabsContent>
        <TabsContent value="historico">
          <HistoricoPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
