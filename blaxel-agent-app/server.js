/**
 * P2P deal agent: talks to other agents directly. No central deal API for propose/accept.
 * Env: COMPANY_ID, COMPANY_NAME, AGENT_REGISTRY (JSON), DEAL_WEBHOOK_URL, PORT.
 * AGENT_REGISTRY: {"other-company-id":{"url":"https://...","company_name":"..."},...}
 */
import http from "node:http";

const COMPANY_ID = process.env.COMPANY_ID || "";
const COMPANY_NAME = process.env.COMPANY_NAME || "";
const AGENT_REGISTRY_JSON = process.env.AGENT_REGISTRY || "{}";
const DEAL_WEBHOOK_URL = process.env.DEAL_WEBHOOK_URL || "";
const PORT = parseInt(process.env.PORT || "3000", 10);

let AGENT_REGISTRY = {};
try {
  AGENT_REGISTRY = JSON.parse(AGENT_REGISTRY_JSON);
} catch {
  AGENT_REGISTRY = {};
}

if (!COMPANY_ID) {
  console.error("COMPANY_ID is required");
  process.exit(1);
}
if (!DEAL_WEBHOOK_URL) {
  console.error("DEAL_WEBHOOK_URL is required (e.g. your deal API /deal_made)");
  process.exit(1);
}

const proposals = new Map();

function randomId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function notifyDealMade(proposal) {
  const base = DEAL_WEBHOOK_URL.replace(/\/$/, "");
  const res = await fetch(base + "/deal_made", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proposal_id: proposal.id,
      from_company_id: proposal.fromCompanyId,
      to_company_id: proposal.toCompanyId,
      terms: proposal.terms,
    }),
  });
  return res.json();
}

async function postToAgent(companyId, path, body) {
  const entry = AGENT_REGISTRY[companyId];
  if (!entry || !entry.url) throw new Error("Unknown agent: " + companyId);
  const base = entry.url.replace(/\/$/, "");
  const url = base + (path.startsWith("/") ? path : "/" + path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function listBots() {
  const bots = [];
  for (const [id, entry] of Object.entries(AGENT_REGISTRY)) {
    if (id === COMPANY_ID) continue;
    bots.push({ id, company_name: entry.company_name || id });
  }
  return { bots };
}

function propose(params) {
  const toId = params.to_company_id;
  const fromId = params.from_company_id || COMPANY_ID;
  if (!toId || fromId !== COMPANY_ID) return { error: "propose: from_company_id must be self, to_company_id required" };
  if (!AGENT_REGISTRY[toId]) return { error: "Unknown to_company_id" };
  const proposalId = randomId();
  const proposal = {
    id: proposalId,
    fromCompanyId: fromId,
    toCompanyId: toId,
    terms: params.terms || {},
    status: "pending",
  };
  proposals.set(proposalId, proposal);
  postToAgent(toId, "/receive_proposal", {
    proposal_id: proposalId,
    from_company_id: fromId,
    to_company_id: toId,
    terms: proposal.terms,
  }).catch(() => {});
  return { proposal_id: proposalId, status: "pending" };
}

function acceptDeal(params) {
  const proposalId = params.proposal_id;
  const asId = params.as_company_id || COMPANY_ID;
  if (!proposalId || !asId) return { error: "proposal_id and as_company_id required" };
  const proposal = proposals.get(proposalId);
  if (!proposal) return { error: "Proposal not found" };
  const isFrom = proposal.fromCompanyId === asId;
  const isTo = proposal.toCompanyId === asId;
  if (!isFrom && !isTo) return { error: "You are not a party to this proposal" };
  if (proposal.status === "accepted_by_both") {
    return { proposal_id: proposalId, status: "accepted_by_both", message: "Deal already confirmed." };
  }
  if (proposal.status === "pending") {
    proposal.status = isFrom ? "accepted_by_from" : "accepted_by_to";
  } else if (proposal.status === "accepted_by_from" && isTo) {
    proposal.status = "accepted_by_both";
  } else if (proposal.status === "accepted_by_to" && isFrom) {
    proposal.status = "accepted_by_both";
  }
  const otherId = isFrom ? proposal.toCompanyId : proposal.fromCompanyId;
  postToAgent(otherId, "/proposal_accepted", { proposal_id: proposalId, accepted_by: asId }).catch(() => {});
  if (proposal.status === "accepted_by_both") {
    notifyDealMade(proposal).catch(() => {});
    return { proposal_id: proposalId, status: "accepted_by_both", message: "Deal made. Both parties will receive an email." };
  }
  return { proposal_id: proposalId, status: proposal.status, message: "Acceptance recorded." };
}

function getProposalStatus(params) {
  const proposal = proposals.get(params.proposal_id);
  if (!proposal) return { error: "Proposal not found" };
  return {
    proposal_id: proposal.id,
    status: proposal.status,
    from: proposal.fromCompanyId,
    to: proposal.toCompanyId,
    terms: proposal.terms,
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const path = req.url?.split("?")[0] || "";

  if (req.method === "GET" && path === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, company_id: COMPANY_ID }));
    return;
  }

  if (req.method === "POST" && path === "/receive_proposal") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body || "{}");
    const proposal = {
      id: data.proposal_id,
      fromCompanyId: data.from_company_id,
      toCompanyId: data.to_company_id,
      terms: data.terms || {},
      status: "pending",
    };
    proposals.set(proposal.id, proposal);
    res.writeHead(200);
    res.end(JSON.stringify({ proposal_id: proposal.id }));
    return;
  }

  if (req.method === "POST" && path === "/proposal_accepted") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body || "{}");
    const proposal = proposals.get(data.proposal_id);
    if (proposal && data.accepted_by) {
      proposal.status = data.accepted_by === proposal.fromCompanyId ? "accepted_by_from" : "accepted_by_to";
    }
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "POST" || path !== "/deal") {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "POST /deal with { method, params }" }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;
  let payload = {};
  try {
    payload = JSON.parse(body || "{}");
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }
  const { method, params = {} } = payload;
  if (!method) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "method required" }));
    return;
  }
  let result;
  try {
    if (method === "list_bots") result = listBots();
    else if (method === "propose") result = propose(params);
    else if (method === "accept_deal") result = acceptDeal(params);
    else if (method === "get_proposal_status") result = getProposalStatus(params);
    else result = { error: "Unknown method: " + method };
  } catch (e) {
    res.writeHead(502);
    res.end(JSON.stringify({ error: String(e.message || e) }));
    return;
  }
  res.writeHead(200);
  res.end(JSON.stringify(result));
});

function tryStartupDeal() {
  const bots = listBots().bots;
  if (bots.length === 0) return;
  const target = bots[0];
  const result = propose({
    to_company_id: target.id,
    terms: {
      from: COMPANY_NAME,
      message: "Hello, let's make a deal",
      proposed_at: new Date().toISOString(),
    },
  });
  if (result.error) {
    console.log("[startup] propose to", target.id, "failed:", result.error);
  } else {
    console.log("[startup] proposed to", target.company_name, "(" + target.id + "), proposal_id:", result.proposal_id);
  }
}

server.listen(PORT, () => {
  console.log(`P2P deal agent (${COMPANY_ID}) on port ${PORT}, webhook: ${DEAL_WEBHOOK_URL}`);
  setTimeout(tryStartupDeal, 3000);
});
