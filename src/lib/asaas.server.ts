// SERVER ONLY — never import from client/route components.
// Reads ASAAS secrets from process.env. Never logs secret values.

export type AsaasEnv = "sandbox" | "production";

const SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
const PRODUCTION_URL = "https://api.asaas.com/v3";

export function getAsaasEnv(): AsaasEnv {
  const raw = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase().trim();
  return raw === "production" || raw === "prod" ? "production" : "sandbox";
}

export function getAsaasBaseUrl(): string {
  const override = process.env.ASAAS_BASE_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  return getAsaasEnv() === "production" ? PRODUCTION_URL : SANDBOX_URL;
}

export class AsaasError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
    this.name = "AsaasError";
  }
}

export type AsaasFetchInit = Omit<RequestInit, "body"> & {
  body?: unknown;
  timeoutMs?: number;
};

type AsaasErrorEntry = {
  code?: unknown;
  description?: unknown;
};

function maskDigits(value: unknown, visibleStart = 2, visibleEnd = 2): unknown {
  if (typeof value !== "string" && typeof value !== "number") return value;
  const raw = String(value);
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= visibleStart + visibleEnd) return "***";
  return `${digits.slice(0, visibleStart)}${"*".repeat(Math.max(3, digits.length - visibleStart - visibleEnd))}${digits.slice(-visibleEnd)}`;
}

function maskEmail(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const [local, domain] = value.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

function sanitizeForAsaasLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForAsaasLog);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      const k = key.toLowerCase();
      if (k.includes("token") || k.includes("apikey") || k.includes("api_key") || k.includes("secret")) {
        return [key, "[redacted]"];
      }
      if (k === "cpfcnpj" || k.includes("cpf") || k.includes("cnpj")) return [key, maskDigits(entry, 2, 2)];
      if (k.includes("email")) return [key, maskEmail(entry)];
      if (k.includes("phone") || k.includes("telefone") || k.includes("whatsapp")) return [key, maskDigits(entry, 2, 2)];
      return [key, sanitizeForAsaasLog(entry)];
    }),
  );
}

function getAsaasErrors(body: unknown): AsaasErrorEntry[] {
  if (!body || typeof body !== "object" || !("errors" in body)) return [];
  const errors = (body as { errors?: unknown }).errors;
  return Array.isArray(errors) ? (errors as AsaasErrorEntry[]) : [];
}

function buildAsaasErrorMessage(path: string, status: number, body: unknown): string {
  const descriptions = getAsaasErrors(body)
    .map((e) => (typeof e.description === "string" ? e.description.trim() : ""))
    .filter(Boolean);
  if (!descriptions.length) return `Asaas responded ${status}`;

  const target = path.startsWith("/customers") ? "os dados do cliente" : "a requisição";
  return `Asaas recusou ${target}: ${descriptions.join("; ")}`;
}

/**
 * Server-side fetch helper for Asaas API.
 * - Selects base URL from ASAAS_ENV (sandbox default).
 * - Injects `access_token` auth header from ASAAS_API_KEY.
 * - Applies a request timeout (default 15s).
 * - Throws AsaasError on non-2xx; never leaks the API key into errors/logs.
 *
 * NOTE: This helper is intentionally NOT invoked anywhere yet (Phase 2 = setup
 * only). Real cobrança/customer/subscription calls land in Phase 3+.
 */
export async function asaasFetch<T = unknown>(path: string, init: AsaasFetchInit = {}): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new AsaasError("ASAAS_API_KEY ausente", 500);

  const base = getAsaasBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const timeoutMs = init.timeoutMs ?? 15_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init.headers as HeadersInit | undefined);
  headers.set("access_token", apiKey);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let body: BodyInit | undefined;
  if (init.body !== undefined) {
    body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
  }

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      body,
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    }

    if (!res.ok) {
      // Log without secret values
      const errors = getAsaasErrors(parsed).map((e) => ({
        code: e.code,
        description: e.description,
      }));
      console.error("[asaas] request failed", {
        method: init.method ?? "GET",
        path,
        status: res.status,
        requestBody: sanitizeForAsaasLog(init.body),
        responseBody: sanitizeForAsaasLog(parsed),
        errors,
      });
      throw new AsaasError(buildAsaasErrorMessage(path, res.status, parsed), res.status, parsed);
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof AsaasError) throw err;
    if ((err as Error)?.name === "AbortError") {
      throw new AsaasError(`Asaas request timed out after ${timeoutMs}ms`, 504);
    }
    throw new AsaasError((err as Error)?.message ?? "Asaas request failed", 500);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------- Billing data gate ----------------

export type CompanyBillingFields = {
  name?: string | null;
  razao_social?: string | null;
  email?: string | null;
  email_financeiro?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  responsavel_telefone?: string | null;
  cnpj?: string | null;
  responsavel_cpf?: string | null;
};

export type BillingValidation = {
  ok: boolean;
  missing: Array<"cpf_cnpj" | "nome" | "email" | "telefone">;
};

/** Pure validator — does not throw. Returns granular missing list for UI. */
export function validateBillingData(c: CompanyBillingFields | null | undefined): BillingValidation {
  const missing: BillingValidation["missing"] = [];
  if (!c) {
    return { ok: false, missing: ["nome", "cpf_cnpj", "email", "telefone"] };
  }
  const digits = (v?: string | null) => (v ?? "").replace(/\D/g, "");
  const cnpj = digits(c.cnpj);
  const cpf = digits(c.responsavel_cpf);
  if (cnpj.length !== 14 && cpf.length !== 11) missing.push("cpf_cnpj");

  if (!((c.razao_social ?? c.name ?? "").trim())) missing.push("nome");
  if (!((c.email_financeiro ?? c.email ?? "").trim())) missing.push("email");
  const tel = digits(c.responsavel_telefone) || digits(c.whatsapp) || digits(c.phone);
  if (tel.length < 10) missing.push("telefone");

  return { ok: missing.length === 0, missing };
}

/** Throwing variant for server fns. Uses Response(412) to signal the UI to surface the gate. */
export function assertBillingDataComplete(c: CompanyBillingFields | null | undefined): void {
  const r = validateBillingData(c);
  if (!r.ok) {
    throw new Response(
      JSON.stringify({
        error: "billing_data_incomplete",
        message: "Complete os dados fiscais da empresa antes de continuar com a assinatura.",
        missing: r.missing,
      }),
      { status: 412, headers: { "Content-Type": "application/json" } },
    );
  }
}
