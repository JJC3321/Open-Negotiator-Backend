export interface CompanyContext {
  id: string;
  email: string;
  company_name: string;
  short_term_goals: string[];
  long_term_goals: string[];
  domains: string[];
  policies: string[];
  pricing_model: string;
  services: string[];
  created_at: string | null;
  updated_at: string | null;
  source: string | null;
}

export type ApiPayload = Record<string, unknown>;

function ensureList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((x) => String(x));
  }
  if (value == null) {
    return [];
  }
  return [String(value)];
}

export function companyContextFromApiPayload(
  raw: ApiPayload,
  idValue?: string | null
): CompanyContext {
  const now = new Date().toISOString();
  return {
    id: (idValue ?? raw.id ?? "") as string,
    email: (raw.email ?? "") as string,
    company_name: (raw.company_name ?? raw.companyName ?? "") as string,
    short_term_goals: ensureList(raw.short_term_goals ?? raw.shortTermGoals),
    long_term_goals: ensureList(raw.long_term_goals ?? raw.longTermGoals),
    domains: ensureList(raw.domains),
    policies: ensureList(raw.policies),
    pricing_model: (raw.pricing_model ?? raw.pricingModel ?? "") as string,
    services: ensureList(raw.services),
    created_at: (raw.created_at ?? raw.createdAt ?? now) as string,
    updated_at: now,
    source: (raw.source as string) ?? null,
  };
}
