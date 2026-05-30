export type OnboardingItemKey =
  | "meu_restaurante"
  | "cardapio"
  | "pagamentos"
  | "whatsapp"
  | "pedido_teste";

export type OnboardingStatus = {
  companyId: string | null;
  items: Record<OnboardingItemKey, boolean>;
  completed: number;
  total: number;
  percent: number;
  done: boolean;
};
