import path from "node:path";
import { config } from "../config.js";

export const AGENT_REGISTRY_FILENAME = "agent-registry.json";

export function getAgentRegistryPath(): string {
  return path.join(config.DATA_DIR, AGENT_REGISTRY_FILENAME);
}

export type AgentRegistryEntry = {
  url: string;
  company_name: string;
};

export type AgentRegistry = Record<string, AgentRegistryEntry>;

export const DEFAULT_AGENT_REGISTRY: AgentRegistry = {
  "dummy-company-alpha": {
    url: "https://sbx-dummy-company-alpha-ay3r2m.us-pdx-1.bl.run/port/3000",
    company_name: "Alpha Consulting",
  },
  "dummy-company-beta": {
    url: "https://sbx-dummy-company-beta-ay3r2m.us-pdx-1.bl.run/port/3000",
    company_name: "Beta Labs",
  },
};
