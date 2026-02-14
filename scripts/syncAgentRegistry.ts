/**
 * After deploying agents to Blaxel, run this to fetch each sandbox's REST URL
 * (via a public preview on the agent port) and write data/agent-registry.json.
 * Use that file to set AGENT_REGISTRY in each sandbox or when re-generating deployments.
 *
 * Requires Blaxel auth: bl login or BL_API_KEY + BL_WORKSPACE (see docs.blaxel.ai).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../src/config.js";
import type { CompanyContext } from "../src/models.js";
import { getAgentRegistryPath, type AgentRegistry } from "../src/blaxel/agentRegistry.js";
import { SandboxInstance } from "@blaxel/core";

const AGENT_PREVIEW_NAME = "agent-api";
const AGENT_PORT = 3000;

async function loadContexts(): Promise<CompanyContext[]> {
  await fs.mkdir(config.CONTEXTS_DIR, { recursive: true });
  const entries = await fs.readdir(config.CONTEXTS_DIR, { withFileTypes: true });
  const contexts: CompanyContext[] = [];
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(config.CONTEXTS_DIR, ent.name), "utf-8");
    contexts.push(JSON.parse(raw) as CompanyContext);
  }
  return contexts;
}

async function main(): Promise<void> {
  const contexts = await loadContexts();
  if (contexts.length === 0) {
    console.log("No company contexts found. Run npm run seed-dummy (or fetch-onboarding) first.");
    process.exit(1);
  }

  const registry: AgentRegistry = {};

  for (const ctx of contexts) {
    try {
      const sandbox = await SandboxInstance.get(ctx.id);
      const baseUrl = sandbox.metadata?.url;
      if (!baseUrl) {
        console.warn(`  ${ctx.id}: no metadata.url, skipping`);
        continue;
      }
      const preview = await sandbox.previews.createIfNotExists({
        metadata: { name: AGENT_PREVIEW_NAME },
        spec: { port: AGENT_PORT, public: true },
      });
      const url = preview.spec?.url?.replace(/\/$/, "") ?? `${baseUrl}/port/${AGENT_PORT}`;
      registry[ctx.id] = { url, company_name: ctx.company_name };
      console.log(`  ${ctx.id}: ${url}`);
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string };
      if (err?.code === 404 || err?.message?.includes("404")) {
        console.warn(`  ${ctx.id}: not found on Blaxel (deploy with: bl deploy -d blaxel-deployments/${ctx.id})`);
      } else {
        throw e;
      }
    }
  }

  if (Object.keys(registry).length === 0) {
    console.log("No sandbox URLs found. Deploy agents first: bl deploy -d blaxel-deployments/<id>");
    process.exit(1);
  }

  const outPath = getAgentRegistryPath();
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(registry, null, 2), "utf-8");
  console.log(`\nWrote ${outPath}. Use this JSON as AGENT_REGISTRY for each sandbox (Blaxel console or env).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
