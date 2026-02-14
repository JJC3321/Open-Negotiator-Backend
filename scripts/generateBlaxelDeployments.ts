import path from "node:path";
import { config } from "../src/config.js";
import type { CompanyContext } from "../src/models.js";
import { generateAllBlaxelDeployments, DEFAULT_BLAXEL_DEPLOYMENTS_DIR } from "../src/blaxel/index.js";
import fs from "node:fs/promises";

async function loadAllContexts(): Promise<CompanyContext[]> {
  await fs.mkdir(config.CONTEXTS_DIR, { recursive: true });
  const entries = await fs.readdir(config.CONTEXTS_DIR, { withFileTypes: true });
  const contexts: CompanyContext[] = [];
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith(".json")) continue;
    const filePath = path.join(config.CONTEXTS_DIR, ent.name);
    const raw = await fs.readFile(filePath, "utf-8");
    contexts.push(JSON.parse(raw) as CompanyContext);
  }
  return contexts;
}

async function main(): Promise<void> {
  const contexts = await loadAllContexts();
  if (contexts.length === 0) {
    console.log("No company contexts found. Run npm run fetch-onboarding (or seed-dummy) first.");
    process.exit(1);
  }

  const outDir = path.join(config.BASE_DIR, DEFAULT_BLAXEL_DEPLOYMENTS_DIR);
  const dirs = await generateAllBlaxelDeployments(contexts, outDir);

  console.log(`Generated ${dirs.length} Blaxel deal-agent deployment(s):`);
  for (const d of dirs) {
    console.log(`  - ${d}`);
  }
  console.log("");
  console.log("Set DEAL_API_URL in each deployment (Blaxel console or blaxel.toml) to your deal API (e.g. npm run deal-api).");
  console.log("Deploy each agent: bl deploy -d blaxel-deployments/<agent-id>");
  console.log("");
  console.log("Example:");
  console.log(`  bl deploy -d ${path.join(outDir, contexts[0].id)}`);
  console.log("");
  console.log("Requires Blaxel CLI (see https://docs.blaxel.ai/cli-reference/introduction). On Windows use WSL.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
