/**
 * Test P2P deal flow between Alpha and Beta agents.
 * Starts: deal API (3780), Alpha agent (3001), Beta agent (3002).
 * Then runs: list_bots (Alpha), propose (Alpha -> Beta), accept_deal (Beta), accept_deal (Alpha).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const DEAL_API_PORT = 3780;
const ALPHA_PORT = 3001;
const BETA_PORT = 3002;
const ALPHA_URL = `http://localhost:${ALPHA_PORT}`;
const BETA_URL = `http://localhost:${BETA_PORT}`;
const WEBHOOK_URL = `http://localhost:${DEAL_API_PORT}/deal_made`;

const ALPHA_ID = "dummy-company-alpha";
const BETA_ID = "dummy-company-beta";

const children: ReturnType<typeof spawn>[] = [];

function killAll(): void {
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
}

process.on("exit", killAll);
process.on("SIGINT", () => {
  killAll();
  process.exit(130);
});

function waitFor(url: string, label: string, maxAttempts = 30): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const t = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch(url);
        if (r.ok) {
          clearInterval(t);
          resolve();
          return;
        }
      } catch {
        // retry
      }
      if (attempts >= maxAttempts) {
        clearInterval(t);
        reject(new Error(`${label} did not become ready at ${url}`));
      }
    }, 200);
  });
}

async function deal(agentUrl: string, method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const r = await fetch(agentUrl + "/deal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} failed: ${r.status} ${text}`);
  return JSON.parse(text) as unknown;
}

async function main(): Promise<void> {
  console.log("Starting deal API, Alpha agent, Beta agent...");

  const isWindows = process.platform === "win32";
  const node = process.execPath;
  const serverPath = path.join(ROOT, "blaxel-agent-app/server.js");

  const dealApi = spawn(node, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), "src/dealApiServer.ts"], {
    cwd: ROOT,
    env: { ...process.env, DEAL_API_PORT: String(DEAL_API_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(dealApi);

  const alphaRegistry = JSON.stringify({
    [BETA_ID]: { url: BETA_URL, company_name: "Beta Labs" },
  });
  const alpha = spawn(node, [serverPath], {
    cwd: ROOT,
    env: {
      ...process.env,
      COMPANY_ID: ALPHA_ID,
      COMPANY_NAME: "Alpha Consulting",
      PORT: String(ALPHA_PORT),
      DEAL_WEBHOOK_URL: WEBHOOK_URL,
      AGENT_REGISTRY: alphaRegistry,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(alpha);

  const betaRegistry = JSON.stringify({
    [ALPHA_ID]: { url: ALPHA_URL, company_name: "Alpha Consulting" },
  });
  const beta = spawn(node, [serverPath], {
    cwd: ROOT,
    env: {
      ...process.env,
      COMPANY_ID: BETA_ID,
      COMPANY_NAME: "Beta Labs",
      PORT: String(BETA_PORT),
      DEAL_WEBHOOK_URL: WEBHOOK_URL,
      AGENT_REGISTRY: betaRegistry,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(beta);

  await Promise.all([
    waitFor(`http://localhost:${DEAL_API_PORT}/health`, "Deal API"),
    waitFor(ALPHA_URL + "/health", "Alpha"),
    waitFor(BETA_URL + "/health", "Beta"),
  ]);
  console.log("All services up.\n");

  console.log("1. Alpha list_bots...");
  const list = (await deal(ALPHA_URL, "list_bots")) as { bots: { id: string; company_name: string }[] };
  if (!list.bots?.some((b) => b.id === BETA_ID)) {
    throw new Error("Alpha list_bots should include Beta: " + JSON.stringify(list));
  }
  console.log("   Bots:", list.bots.map((b) => b.id).join(", "));

  console.log("2. Alpha proposes to Beta...");
  const proposed = (await deal(ALPHA_URL, "propose", {
    to_company_id: BETA_ID,
    terms: { amount: 100, description: "Test deal" },
  })) as { proposal_id?: string; error?: string };
  if (proposed.error) throw new Error("propose: " + proposed.error);
  const proposalId = proposed.proposal_id;
  if (!proposalId) throw new Error("Missing proposal_id");
  console.log("   proposal_id:", proposalId);

  await new Promise((r) => setTimeout(r, 400));

  console.log("3. Beta accept_deal...");
  const betaAccept = (await deal(BETA_URL, "accept_deal", {
    proposal_id: proposalId,
    as_company_id: BETA_ID,
  })) as { status?: string; error?: string };
  if (betaAccept.error) throw new Error("Beta accept: " + betaAccept.error);
  console.log("   status:", betaAccept.status);

  await new Promise((r) => setTimeout(r, 600));

  console.log("4. Alpha accept_deal...");
  const alphaAccept = (await deal(ALPHA_URL, "accept_deal", {
    proposal_id: proposalId,
    as_company_id: ALPHA_ID,
  })) as { status?: string; message?: string; error?: string };
  if (alphaAccept.error) throw new Error("Alpha accept: " + alphaAccept.error);
  console.log("   status:", alphaAccept.status, alphaAccept.message ?? "");

  if (alphaAccept.status !== "accepted_by_both") {
    throw new Error("Expected status accepted_by_both, got " + alphaAccept.status);
  }

  console.log("\nTest passed: Alpha and Beta completed a deal (P2P).");
  killAll();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  killAll();
  process.exit(1);
});
