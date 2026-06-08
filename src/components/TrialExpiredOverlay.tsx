import { Lock, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Plano = {
  id: "base" | "pro" | "max";
  nome: string;
  pedidos: string;
  conversas: string;
  usuarios: string;
  destaque?: boolean;
};

const PLANOS: Plano[] = [
  { id: "base", nome: "Base", pedidos: "300 pedidos/mês", conversas: "300 conversas/mês", usuarios: "1 usuário" },
  { id: "pro", nome: "Pro", pedidos: "1.500 pedidos/mês", conversas: "1.500 conversas/mês", usuarios: "3 usuários", destaque: true },
  { id: "max", nome: "Max", pedidos: "Pedidos ilimitados", conversas: "3.000 conversas/mês", usuarios: "8 usuários" },
];

export function TrialExpiredOverlay({ canChoosePlan }: { canChoosePlan: boolean }) {
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-3xl my-8 rounded-2xl border border-border bg-card shadow-elevated">
        <div className="p-6 lg:p-8 border-b border-border text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Seu período de teste terminou.</h2>
          {canChoosePlan ? (
            <p className="text-muted-foreground">
              Escolha um plano para continuar utilizando o SaiuPedido.
            </p>
          ) : (
            <p className="text-muted-foreground max-w-md mx-auto">
              Solicite ao administrador da empresa que escolha um plano para continuar utilizando o SaiuPedido.
            </p>
          )}
        </div>

        {canChoosePlan ? (
          <div className="p-6 lg:p-8 space-y-6">
            {/* Toggle ciclo */}
            <div className="flex justify-center">
              <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-1">
                <button
                  type="button"
                  onClick={() => setCiclo("mensal")}
                  className={cn(
                    "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                    ciclo === "mensal" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground",
                  )}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setCiclo("anual")}
                  className={cn(
                    "px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                    ciclo === "anual" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground",
                  )}
                >
                  Anual
                  <Badge variant="secondary" className="text-[10px] px-1.5">Economize ~17%</Badge>
                </button>
              </div>
            </div>

            {/* Planos */}
            <div className="grid gap-4 md:grid-cols-3">
              {PLANOS.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "relative rounded-xl border p-5 flex flex-col gap-3 transition-colors",
                    p.destaque ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  {p.destaque && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">Mais popular</Badge>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{p.nome}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ciclo === "anual" ? "Cobrado anualmente" : "Cobrado mensalmente"}
                    </p>
                  </div>
                  <ul className="text-sm space-y-1.5 text-muted-foreground">
                    <li>✓ {p.pedidos}</li>
                    <li>✓ {p.conversas}</li>
                    <li>✓ {p.usuarios}</li>
                  </ul>
                  <Button
                    className="mt-auto"
                    variant={p.destaque ? "default" : "outline"}
                    onClick={() => navigate({ to: "/assinatura/escolher-plano" })}
                  >
                    Escolher {p.nome}
                  </Button>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Sua escolha será registrada. O pagamento online estará disponível em breve.
            </p>
          </div>
        ) : (
          <div className="p-6 lg:p-8 space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-medium">Como prosseguir</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" /> Avise o administrador por e-mail
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" /> Ou entre em contato direto
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
