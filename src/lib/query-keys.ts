export const qk = {
  pedidos: ["pedidos"] as const,
  pedido: (id: string) => ["pedidos", id] as const,
  mesas: ["mesas"] as const,
  mesa: (id: string) => ["mesas", id] as const,
  produtos: ["produtos"] as const,
  categorias: ["categorias"] as const,
  adicionais: ["adicionais"] as const,
  combos: ["combos"] as const,
  clientes: ["clientes"] as const,
  companies: ["companies"] as const,
  users: ["users"] as const,
  audit: ["audit"] as const,
  mensagens: ["mensagens"] as const,
  dashboard: (granularity: string, from: string, to: string) =>
    ["dashboard", granularity, from, to] as const,
};
