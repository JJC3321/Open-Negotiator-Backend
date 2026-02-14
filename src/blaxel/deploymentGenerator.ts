import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { CompanyContext } from "../models.js";

const AGENT_PORT = 3000;

export const DEFAULT_BLAXEL_DEPLOYMENTS_DIR = "blaxel-deployments";
const AGENT_APP_SERVER = "blaxel-agent-app/server.js";

export interface GenerateBlaxelDeploymentOptions {
  context: CompanyContext;
  outDir: string;
}

function blaxelTomlContent(agentId: string, companyName: string): string {
  return `name = "${agentId}"
type = "sandbox"
description = "Deal agent - ${companyName}"

[runtime]
generation = "mk3"
memory = 2048

[[runtime.ports]]
name = "agent-api"
target = ${AGENT_PORT}
protocol = "tcp"

[env]
COMPANY_ID = "${agentId}"
DEAL_API_URL = ""
PORT = "${AGENT_PORT}"
`;
}

function dockerfileContent(serverJsBase64: string): string {
  return `# Blaxel sandbox: deal agent (calls central deal API)
FROM node:22-slim

COPY --from=ghcr.io/blaxel-ai/sandbox:latest /sandbox-api /usr/local/bin/sandbox-api

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \\
  ca-certificates netcat-openbsd \\
  && rm -rf /var/lib/apt/lists/*

# Inline server.js so build context does not need to include it
RUN echo "${serverJsBase64}" | base64 -d > /app/server.js

RUN printf '%s\\n' \\
  '#!/bin/sh' \\
  'set -e' \\
  '/usr/local/bin/sandbox-api &' \\
  'while ! nc -z 127.0.0.1 8080; do sleep 0.2; done' \\
  'exec node /app/server.js' \\
  > /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
`;
}

export async function generateBlaxelDeployment(
  options: GenerateBlaxelDeploymentOptions
): Promise<string> {
  const { context, outDir } = options;
  const agentDir = path.join(outDir, context.id);
  await fs.mkdir(agentDir, { recursive: true });

  await fs.writeFile(
    path.join(agentDir, "blaxel.toml"),
    blaxelTomlContent(context.id, context.company_name),
    "utf-8"
  );

  const agentAppPath = path.join(config.BASE_DIR, AGENT_APP_SERVER);
  const serverJs = await fs.readFile(agentAppPath, "utf-8");
  const serverJsBase64 = Buffer.from(serverJs, "utf-8").toString("base64");
  await fs.writeFile(path.join(agentDir, "Dockerfile"), dockerfileContent(serverJsBase64), "utf-8");

  return agentDir;
}

export async function generateAllBlaxelDeployments(
  contexts: CompanyContext[],
  outDir: string = path.join(config.BASE_DIR, DEFAULT_BLAXEL_DEPLOYMENTS_DIR)
): Promise<string[]> {
  const dirs: string[] = [];
  for (const ctx of contexts) {
    const dir = await generateBlaxelDeployment({ context: ctx, outDir });
    dirs.push(dir);
  }
  return dirs;
}
