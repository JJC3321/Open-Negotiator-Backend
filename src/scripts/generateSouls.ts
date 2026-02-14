import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { CompanyContext } from "../models.js";
import { writeSoulFile } from "../soulGenerator.js";

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
  for (const ctx of contexts) {
    const outPath = await writeSoulFile(ctx);
    console.log(`Generated SOUL: ${outPath} for ${ctx.company_name}`);
  }
  console.log(`Done. Generated ${contexts.length} SOUL file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
