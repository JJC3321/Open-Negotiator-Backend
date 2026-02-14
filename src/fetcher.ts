import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import {
  type CompanyContext,
  companyContextFromApiPayload,
  type ApiPayload,
} from "./models.js";
import { randomUUID } from "node:crypto";

const DEFAULT_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
};

export async function fetchOnboardingData(): Promise<ApiPayload[]> {
  const url = config.ONBOARDING_API_URL;
  if (!url) {
    throw new Error("ONBOARDING_API_URL is not set");
  }
  const headers: Record<string, string> = { ...DEFAULT_HEADERS };
  if (config.ONBOARDING_API_KEY) {
    headers["Authorization"] = `Bearer ${config.ONBOARDING_API_KEY}`;
    headers["X-API-Key"] = config.ONBOARDING_API_KEY;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Onboarding API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return data as ApiPayload[];
  }
  if (data?.items && Array.isArray(data.items)) {
    return data.items as ApiPayload[];
  }
  if (data?.data && Array.isArray(data.data)) {
    return data.data as ApiPayload[];
  }
  return [data as ApiPayload];
}

export async function ensureContextsDir(): Promise<string> {
  await fs.mkdir(config.CONTEXTS_DIR, { recursive: true });
  return config.CONTEXTS_DIR;
}

export function normalizeToContext(raw: ApiPayload, idValue?: string | null): CompanyContext {
  const id = (idValue ?? (raw.id as string) ?? randomUUID()) as string;
  return companyContextFromApiPayload({ ...raw, id }, id);
}

export async function writeContextFile(ctx: CompanyContext): Promise<string> {
  await ensureContextsDir();
  const filePath = path.join(config.CONTEXTS_DIR, `${ctx.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(ctx, null, 2), "utf-8");
  return filePath;
}

export async function fetchAndPersistContexts(): Promise<CompanyContext[]> {
  const rawList = await fetchOnboardingData();
  const contexts: CompanyContext[] = [];
  for (const raw of rawList) {
    const ctx = normalizeToContext(raw);
    await writeContextFile(ctx);
    contexts.push(ctx);
  }
  return contexts;
}
