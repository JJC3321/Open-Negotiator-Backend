import http from "node:http";
import {
  listBots,
  propose,
  acceptDeal,
  getProposalStatus,
  type ProposeParams,
  type AcceptDealParams,
  type GetProposalStatusParams,
} from "./dealToolsCore.js";

const DEFAULT_PORT = 3780;

async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function handleDealRequest(
  method: string,
  params: Record<string, unknown>
): Promise<{ status: number; body: unknown }> {
  switch (method) {
    case "list_bots": {
      const result = await listBots();
      return { status: 200, body: result };
    }
    case "propose": {
      const result = await propose(params as unknown as ProposeParams);
      return { status: 200, body: result };
    }
    case "accept_deal": {
      const result = await acceptDeal(params as unknown as AcceptDealParams);
      return { status: 200, body: result };
    }
    case "get_proposal_status": {
      const result = await getProposalStatus(params as unknown as GetProposalStatusParams);
      return { status: 200, body: result };
    }
    default:
      return { status: 400, body: { error: `Unknown method: ${method}` } };
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/deal") {
    if (req.method === "GET" && req.url === "/health") {
      send(res, 200, { ok: true });
      return;
    }
    send(res, 404, { error: "Not found. POST /deal with { method, params }." });
    return;
  }

  const body = (await parseBody(req)) as { method?: string; params?: Record<string, unknown> };
  const method = body?.method ?? "";
  const params = body?.params ?? {};

  const { status, body: result } = await handleDealRequest(method, params);
  send(res, status, result);
});

const port = parseInt(process.env.DEAL_API_PORT ?? String(DEFAULT_PORT), 10);
server.listen(port, () => {
  console.log(`Deal API server listening on port ${port}`);
});
