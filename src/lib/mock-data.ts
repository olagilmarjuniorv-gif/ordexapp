export type QuoteStatus = "rascunho" | "enviado" | "aprovado" | "recusado";
export type OrderStatus = "novo" | "separando" | "pronto" | "entregue";

export type ProductCategory =
  | "Cimento"
  | "Areia e Brita"
  | "Tijolos e Blocos"
  | "Tintas"
  | "Hidráulica"
  | "Elétrica"
  | "Ferramentas"
  | "Acabamento";

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
  category: ProductCategory;
  minStock: number;
}

export const productCategories: ProductCategory[] = [
  "Cimento",
  "Areia e Brita",
  "Tijolos e Blocos",
  "Tintas",
  "Hidráulica",
  "Elétrica",
  "Ferramentas",
  "Acabamento",
];

export const products: Product[] = [
  { id: "p1", name: "Cimento CP II 50kg", price: 38.9, stock: 120, unit: "sc", category: "Cimento", minStock: 30 },
  { id: "p2", name: "Areia média lavada", price: 120, stock: 8, unit: "m³", category: "Areia e Brita", minStock: 5 },
  { id: "p3", name: "Brita nº 1", price: 145, stock: 4, unit: "m³", category: "Areia e Brita", minStock: 5 },
  { id: "p4", name: "Tijolo baiano 9x19x19", price: 0.55, stock: 6500, unit: "un", category: "Tijolos e Blocos", minStock: 1000 },
  { id: "p5", name: "Bloco estrutural 14x19x39", price: 4.05, stock: 220, unit: "un", category: "Tijolos e Blocos", minStock: 300 },
  { id: "p6", name: "Tinta acrílica branca 18L", price: 245, stock: 18, unit: "lt", category: "Tintas", minStock: 6 },
  { id: "p7", name: "Massa corrida 5kg", price: 38, stock: 2, unit: "un", category: "Acabamento", minStock: 8 },
  { id: "p8", name: "Tubo PVC esgoto 100mm 6m", price: 89.9, stock: 24, unit: "un", category: "Hidráulica", minStock: 10 },
  { id: "p9", name: "Fio flexível 2,5mm 100m", price: 189, stock: 9, unit: "rl", category: "Elétrica", minStock: 5 },
  { id: "p10", name: "Furadeira de impacto 650W", price: 349, stock: 5, unit: "un", category: "Ferramentas", minStock: 2 },
];

export interface Customer {
  id: string;
  name: string;
  phone: string;
  city: string;
  lastOrder?: string;
}

export interface QuoteItem {
  description: string;
  qty: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  number: string;
  customerId: string;
  items: QuoteItem[];
  status: QuoteStatus;
  createdAt: string;
  total: number;
}

export interface Order {
  id: string;
  number: string;
  customerId: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
}

export const customers: Customer[] = [
  { id: "c1", name: "João Construções", phone: "+55 11 98888-1010", city: "São Paulo", lastOrder: "há 2 dias" },
  { id: "c2", name: "Maria Reformas", phone: "+55 11 97777-2020", city: "Guarulhos", lastOrder: "ontem" },
  { id: "c3", name: "Pedro Obras ME", phone: "+55 11 96666-3030", city: "Osasco", lastOrder: "há 5 dias" },
  { id: "c4", name: "Construtora Vale", phone: "+55 11 95555-4040", city: "São Paulo" },
  { id: "c5", name: "Carlos Empreiteiro", phone: "+55 11 94444-5050", city: "Santo André", lastOrder: "hoje" },
];

export const quotes: Quote[] = [
  {
    id: "q1", number: "OR-1042", customerId: "c1", status: "enviado", createdAt: "Hoje 09:42",
    total: 1284.5,
    items: [
      { description: "Cimento CP II 50kg", qty: 20, unitPrice: 38.9 },
      { description: "Areia média (m³)", qty: 2, unitPrice: 120 },
      { description: "Tijolo baiano", qty: 500, unitPrice: 0.55 },
    ],
  },
  {
    id: "q2", number: "OR-1041", customerId: "c2", status: "aprovado", createdAt: "Hoje 08:15",
    total: 642.0,
    items: [
      { description: "Tinta acrílica 18L", qty: 2, unitPrice: 245 },
      { description: "Massa corrida 5kg", qty: 4, unitPrice: 38 },
    ],
  },
  {
    id: "q3", number: "OR-1040", customerId: "c5", status: "rascunho", createdAt: "Ontem 17:30",
    total: 2430.0,
    items: [{ description: "Bloco estrutural", qty: 600, unitPrice: 4.05 }],
  },
  {
    id: "q4", number: "OR-1039", customerId: "c3", status: "recusado", createdAt: "Ontem 11:00",
    total: 380.0,
    items: [{ description: "Cal hidratada 20kg", qty: 10, unitPrice: 38 }],
  },
];

export const orders: Order[] = [
  { id: "o1", number: "PD-308", customerId: "c2", total: 642.0, status: "separando", createdAt: "Hoje 08:30" },
  { id: "o2", number: "PD-307", customerId: "c1", total: 1840.0, status: "pronto", createdAt: "Hoje 07:50" },
  { id: "o3", number: "PD-306", customerId: "c4", total: 980.0, status: "entregue", createdAt: "Ontem" },
  { id: "o4", number: "PD-305", customerId: "c5", total: 320.0, status: "novo", createdAt: "Hoje 10:10" },
];

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const customerById = (id: string) => customers.find((c) => c.id === id);

export const quoteStatusLabel: Record<QuoteStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export const orderStatusLabel: Record<OrderStatus, string> = {
  novo: "Novo",
  separando: "Separando",
  pronto: "Pronto",
  entregue: "Entregue",
};
