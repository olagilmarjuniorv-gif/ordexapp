// iFood integration server helpers.
// Phase 1: mock-friendly polling. Real OAuth + Orders API endpoints are wired
// behind env flags so production can flip on when credentials are configured.

const IFOOD_BASE = "https://merchant-api.ifood.com.br";

export type IfoodCredentials = {
  clientId: string;
  clientSecret: string;
};

export function getIfoodCredentials(): IfoodCredentials | null {
  const clientId = process.env.IFOOD_CLIENT_ID;
  const clientSecret = process.env.IFOOD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export type NormalizedItem = {
  kind: "produto";
  name: string;
  quantity: number;
  price: number;
  observacao: string | null;
  adicionais: { name: string; price: number }[];
};

export type NormalizedIfoodOrder = {
  external_order_id: string;
  total_amount: number;
  observacao: string | null;
  items: NormalizedItem[];
  customer: { name: string | null; phone: string | null; address: string | null };
  payment_method: string | null;
  delivery_fee: number;
  raw: unknown;
};

/**
 * Transforms an iFood order payload into ORDEX standard shape.
 * Tolerant to missing fields — iFood payloads change format between
 * marketplaces (delivery vs balcão vs retirada).
 */
export function normalizeIfoodOrder(raw: any): NormalizedIfoodOrder {
  const items: NormalizedItem[] = (raw?.items ?? []).map((it: any) => ({
    kind: "produto" as const,
    name: String(it?.name ?? "Item iFood"),
    quantity: Number(it?.quantity ?? 1),
    price: Number(it?.unitPrice ?? it?.price ?? 0),
    observacao: it?.observations ?? null,
    adicionais: Array.isArray(it?.options)
      ? it.options.map((o: any) => ({
          name: String(o?.name ?? ""),
          price: Number(o?.price ?? 0),
        }))
      : [],
  }));

  const customer = raw?.customer ?? {};
  const delivery = raw?.delivery ?? {};
  const address = delivery?.deliveryAddress ?? customer?.address ?? null;

  const total =
    Number(raw?.total?.orderAmount ?? raw?.totalPrice ?? 0) ||
    items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  return {
    external_order_id: String(raw?.id ?? raw?.orderId ?? raw?.shortId ?? crypto.randomUUID()),
    total_amount: total,
    observacao: raw?.observations ?? null,
    items,
    customer: {
      name: customer?.name ?? null,
      phone: customer?.phone?.number ?? customer?.phone ?? null,
      address: address ? formatAddress(address) : null,
    },
    payment_method: raw?.payments?.[0]?.method ?? null,
    delivery_fee: Number(raw?.total?.deliveryFee ?? delivery?.deliveryFee ?? 0),
    raw,
  };
}

function formatAddress(a: any): string {
  if (typeof a === "string") return a;
  const parts = [a?.streetName, a?.streetNumber, a?.neighborhood, a?.city, a?.state]
    .filter(Boolean);
  return parts.join(", ");
}

/**
 * Fetches new orders from iFood polling endpoint.
 * Returns mock data if IFOOD_MOCK is enabled or credentials missing.
 */
export async function pollIfoodOrders(
  _accessToken: string | null,
  _merchantId: string | null,
): Promise<NormalizedIfoodOrder[]> {
  const creds = getIfoodCredentials();
  const mockMode = process.env.IFOOD_MOCK === "1" || !creds || !_accessToken;

  if (mockMode) {
    // Generate 0-2 mock orders to simulate polling.
    const count = Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? 1 : 2;
    return Array.from({ length: count }).map((_, i) => {
      const id = `mock-${Date.now()}-${i}`;
      return normalizeIfoodOrder({
        id,
        items: [
          { name: "X-Burger", quantity: 1, unitPrice: 28, observations: "Sem cebola" },
          { name: "Coca-Cola Lata", quantity: 1, unitPrice: 7 },
        ],
        customer: { name: "Cliente iFood (mock)", phone: { number: "11999999999" } },
        delivery: {
          deliveryAddress: {
            streetName: "Rua das Flores",
            streetNumber: "100",
            neighborhood: "Centro",
            city: "São Paulo",
            state: "SP",
          },
          deliveryFee: 6,
        },
        total: { orderAmount: 41, deliveryFee: 6 },
        payments: [{ method: "PIX" }],
      });
    });
  }

  // Real polling: GET /order/v1.0/events:polling
  const eventsRes = await fetch(`${IFOOD_BASE}/order/v1.0/events:polling`, {
    headers: { Authorization: `Bearer ${_accessToken}` },
  });
  if (!eventsRes.ok) throw new Error(`iFood polling falhou: ${eventsRes.status}`);
  const events = (await eventsRes.json()) as Array<{ orderId: string; code: string }>;

  const placed = events.filter((e) => e.code === "PLC" || e.code === "PLACED");
  const orders: NormalizedIfoodOrder[] = [];
  for (const ev of placed) {
    const det = await fetch(`${IFOOD_BASE}/order/v1.0/orders/${ev.orderId}`, {
      headers: { Authorization: `Bearer ${_accessToken}` },
    });
    if (det.ok) orders.push(normalizeIfoodOrder(await det.json()));
  }

  // ACK consumed events.
  if (events.length) {
    await fetch(`${IFOOD_BASE}/order/v1.0/events/acknowledgment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${_accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(events.map((e) => ({ id: (e as any).id }))),
    });
  }

  return orders;
}

/**
 * Exchanges iFood client credentials for an access token.
 * Stub-friendly: returns mock token if credentials missing.
 */
export async function refreshIfoodToken(): Promise<{
  access_token: string;
  expires_in: number;
  mocked: boolean;
}> {
  const creds = getIfoodCredentials();
  if (!creds) {
    return { access_token: "mock-token", expires_in: 3600, mocked: true };
  }
  const res = await fetch(`${IFOOD_BASE}/authentication/v1.0/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grantType: "client_credentials",
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`iFood auth falhou: ${res.status}`);
  const json = (await res.json()) as any;
  return {
    access_token: String(json.accessToken ?? json.access_token),
    expires_in: Number(json.expiresIn ?? json.expires_in ?? 3600),
    mocked: false,
  };
}
