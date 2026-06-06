import { AlertTriangle, Clock } from "lucide-react";
import type { TrialInfo } from "@/lib/trial";

export function TrialBanner({ trial }: { trial: TrialInfo | null | undefined }) {
  if (!trial || !trial.isTrial) return null;

  if (trial.expirado) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
        <div>
          <p className="font-semibold text-destructive">Seu período de teste expirou.</p>
          <p className="text-muted-foreground mt-0.5">Entre em contato para ativar seu plano.</p>
        </div>
      </div>
    );
  }

  const d = trial.diasRestantes ?? 0;
  const label = d === 1 ? "1 dia restante" : `${d} dias restantes`;
  const urgente = d <= 3;

  return (
    <div
      className={
        "flex items-start gap-3 rounded-lg border p-4 text-sm " +
        (urgente
          ? "border-orange-500/40 bg-orange-500/10"
          : "border-primary/30 bg-primary/5")
      }
    >
      <Clock className={"h-5 w-5 shrink-0 mt-0.5 " + (urgente ? "text-orange-600" : "text-primary")} />
      <div>
        <p className="font-semibold">Seu período de teste termina em {label}.</p>
        <p className="text-muted-foreground mt-0.5">
          Aproveite para configurar tudo. Após o término, contate o administrador para ativar seu plano.
        </p>
      </div>
    </div>
  );
}
