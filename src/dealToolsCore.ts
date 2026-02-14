import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import type { CompanyContext } from "./models.js";
import { handleDealMade } from "./dealHandler.js";

interface Proposal {
  id: string;
  fromCompanyId: string;
  toCompanyId: string;
  terms: Record<string, unknown>;
  status: "pending" | "accepted_by_from" | "accepted_by_to" | "accepted_by_both";
}

const proposals = new Map<string, Proposal>();

export async function loadContext(companyId: string): Promise<CompanyContext | null> {
  try {
    const filePath = path.join(config.CONTEXTS_DIR, `${companyId}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as CompanyContext;
  } catch {
    return null;
  }
}

export async function listContextIds(): Promise<string[]> {
  await fs.mkdir(config.CONTEXTS_DIR, { recursive: true });
  const entries = await fs.readdir(config.CONTEXTS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => e.name.replace(/\.json$/, ""));
}

export interface ListBotsResult {
  bots: Array<{ id: string; company_name: string }>;
}

export async function listBots(): Promise<ListBotsResult> {
  const ids = await listContextIds();
  const contexts = await Promise.all(ids.map((id) => loadContext(id)));
  const bots = contexts
    .filter((c): c is CompanyContext => c !== null)
    .map((c) => ({ id: c.id, company_name: c.company_name }));
  return { bots };
}

export interface ProposeParams {
  from_company_id: string;
  to_company_id: string;
  terms: Record<string, unknown>;
}

export interface ProposeResult {
  proposal_id?: string;
  status?: string;
  error?: string;
}

export async function propose(params: ProposeParams): Promise<ProposeResult> {
  const { to_company_id, terms, from_company_id } = params;
  if (!to_company_id) {
    return { error: "to_company_id required" };
  }
  const proposalId = randomUUID();
  proposals.set(proposalId, {
    id: proposalId,
    fromCompanyId: from_company_id ?? "",
    toCompanyId: to_company_id,
    terms: terms ?? {},
    status: "pending",
  });
  return { proposal_id: proposalId, status: "pending" };
}

export interface AcceptDealParams {
  proposal_id: string;
  as_company_id: string;
}

export interface AcceptDealResult {
  proposal_id?: string;
  status?: string;
  message?: string;
  error?: string;
}

export async function acceptDeal(params: AcceptDealParams): Promise<AcceptDealResult> {
  const { proposal_id: proposalId, as_company_id: asCompanyId } = params;
  if (!proposalId || !asCompanyId) {
    return { error: "proposal_id and as_company_id required" };
  }
  const proposal = proposals.get(proposalId);
  if (!proposal) {
    return { error: "Proposal not found" };
  }
  const isFrom = proposal.fromCompanyId === asCompanyId;
  const isTo = proposal.toCompanyId === asCompanyId;
  if (!isFrom && !isTo) {
    return { error: "You are not a party to this proposal" };
  }
  if (proposal.status === "accepted_by_both") {
    return { message: "Deal already confirmed.", proposal_id: proposalId };
  }
  if (proposal.status === "pending") {
    proposal.status = isFrom ? "accepted_by_from" : "accepted_by_to";
  } else if (proposal.status === "accepted_by_from" && isTo) {
    proposal.status = "accepted_by_both";
  } else if (proposal.status === "accepted_by_to" && isFrom) {
    proposal.status = "accepted_by_both";
  }
  if (proposal.status === "accepted_by_both") {
    await handleDealMade(
      {
        proposalId,
        fromCompanyId: proposal.fromCompanyId,
        toCompanyId: proposal.toCompanyId,
        terms: proposal.terms,
      },
      loadContext
    );
  }
  return {
    proposal_id: proposalId,
    status: proposal.status,
    message:
      proposal.status === "accepted_by_both"
        ? "Deal made. Both parties will receive an email."
        : "Acceptance recorded.",
  };
}

export interface GetProposalStatusParams {
  proposal_id: string;
}

export interface GetProposalStatusResult {
  proposal_id?: string;
  status?: string;
  from?: string;
  to?: string;
  terms?: Record<string, unknown>;
  error?: string;
}

export async function getProposalStatus(
  params: GetProposalStatusParams
): Promise<GetProposalStatusResult> {
  const proposalId = params.proposal_id;
  const proposal = proposalId ? proposals.get(proposalId) : undefined;
  if (!proposal) {
    return { error: "Proposal not found" };
  }
  return {
    proposal_id: proposal.id,
    status: proposal.status,
    from: proposal.fromCompanyId,
    to: proposal.toCompanyId,
    terms: proposal.terms,
  };
}
