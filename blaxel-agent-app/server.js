/**
 * Minimal deal agent for Blaxel. Calls central deal API with COMPANY_ID.
 * Env: DEAL_API_URL (required), COMPANY_ID (required), PORT (default 3000).
 */
const DEAL_API_URL = process.env.DEAL_API_URL || "";
const COMPANY_ID = process.env.COMPANY_ID || "";
const PORT = parseInt(process.env.PORT || "3000", 10);

if (!DEAL_API_URL || !COMPANY_ID) {
  console.error("DEAL_API_URL and COMPANY_ID are required");
  process.exit(1);
}

async function callDealApi(method, params = {}) {
  let p = { ...params };
  if (method === "propose" && !p.from_company_id) p = { ...p, from_company_id: COMPANY_ID };
  if (method === "accept_deal" && !p.as_company_id) p = { ...p, as_company_id: COMPANY_ID };
  const res = await fetch(`${DEAL_API_URL.replace(/\/$/, "")}/deal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params: p }),
  });
  return res.json();
}

const server = require("http").createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, company_id: COMPANY_ID }));
    return;
  }
  if (req.method !== "POST" || req.url !== "/deal") {
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
  try {
    const result = await callDealApi(method, params);
    res.writeHead(200);
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(502);
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
});

server.listen(PORT, () => {
  console.log(`Deal agent (${COMPANY_ID}) listening on port ${PORT}, deal API: ${DEAL_API_URL}`);
});
