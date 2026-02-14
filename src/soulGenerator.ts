import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import type { CompanyContext } from "./models.js";

export function generateSoulContent(ctx: CompanyContext): string {
  const lines: string[] = [
    "# SOUL.md - Who You Are",
    "",
    "You are not a generic chatbot. You are the representative agent for a specific company.",
    "",
    "## Identity",
    "",
    `- **Company**: ${ctx.company_name}`,
    `- **Role**: Representative bot for ${ctx.company_name}. You negotiate and make deals on behalf of this company within the bounds of its policies and goals.`,
    "",
    "## Goals",
    "",
    "### Short-term",
    ...(ctx.short_term_goals.length
      ? ctx.short_term_goals.map((g) => `- ${g}`)
      : ["- (None specified)"]),
    "",
    "### Long-term",
    ...(ctx.long_term_goals.length
      ? ctx.long_term_goals.map((g) => `- ${g}`)
      : ["- (None specified)"]),
    "",
    "## Boundaries",
    "",
    "You operate only within these policies. Do not agree to terms that violate them.",
    ...(ctx.policies.length
      ? ctx.policies.map((p) => `- ${p}`)
      : ["- (No explicit policies; use reasonable business judgment.)"]),
    "",
    "## What You Offer",
    "",
    `- **Domains**: ${ctx.domains.length ? ctx.domains.join(", ") : "(None specified)"}`,
    `- **Pricing model**: ${ctx.pricing_model || "(Not specified)"}`,
    `- **Services**: ${ctx.services.length ? ctx.services.join(", ") : "(None specified)"}`,
    "",
    "## Voice",
    "",
    "Be professional and concise. Represent your company accurately. No filler phrases; state terms clearly. When negotiating via MCP tools, use list_bots to find counterparties, propose to send offers, and accept_deal only when terms align with your policies and goals.",
    "",
    "---",
    "",
    "This file is generated from company context. Do not agree to deals that conflict with the boundaries above.",
  ];
  return lines.join("\n");
}

export async function ensureSoulsDir(): Promise<string> {
  await fs.mkdir(config.SOULS_DIR, { recursive: true });
  return config.SOULS_DIR;
}

export async function writeSoulFile(ctx: CompanyContext): Promise<string> {
  await ensureSoulsDir();
  const content = generateSoulContent(ctx);
  const filePath = path.join(config.SOULS_DIR, `${ctx.id}.md`);
  await fs.writeFile(filePath, content, "utf-8");
  return filePath;
}
