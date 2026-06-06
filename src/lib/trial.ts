// Cálculo puro de Trial. Sem efeitos colaterais.
export type TrialInfo = {
  isTrial: boolean;
  status: string | null;
  vencimento: string | null;
  diasRestantes: number | null; // null quando não há vencimento ou não é trial
  expirado: boolean;
};

/**
 * Dias restantes do trial: diferença em dias entre vencimento (00:00 local) e hoje (00:00 local).
 * - retorna 0 quando vence hoje
 * - retorna negativo quando já passou (apenas usado internamente; UI usa `expirado`)
 */
export function diasAteVencimento(vencimento: string | null | undefined): number | null {
  if (!vencimento) return null;
  const v = new Date(vencimento + "T00:00:00");
  if (Number.isNaN(v.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ms = v.getTime() - hoje.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function computeTrial(
  status: string | null | undefined,
  vencimento: string | null | undefined,
): TrialInfo {
  const isTrial = status === "trial";
  const dias = diasAteVencimento(vencimento ?? null);
  const expirado = isTrial && dias !== null && dias < 0;
  return {
    isTrial,
    status: status ?? null,
    vencimento: vencimento ?? null,
    diasRestantes: isTrial && dias !== null ? Math.max(dias, 0) : null,
    expirado,
  };
}
