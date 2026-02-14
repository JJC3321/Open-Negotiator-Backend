import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  listBots,
  propose,
  acceptDeal,
  getProposalStatus,
} from "./dealToolsCore.js";

export async function runMcpServer(): Promise<void> {
  const server = new Server(
    { name: "claw-bot-deal-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
      {
        name: "list_bots",
        description:
          "List all available company bots (by company id and name) that can be negotiated with.",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
      {
        name: "propose",
        description:
          "Send a proposal to another company bot. Returns a proposal_id to use in accept_deal.",
        inputSchema: {
          type: "object" as const,
          properties: {
            from_company_id: {
              type: "string",
              description: "Your company id (the proposer)",
            },
            to_company_id: { type: "string", description: "Target company id" },
            terms: {
              type: "object",
              description: "Proposal terms (key-value)",
              additionalProperties: true,
            },
          },
          required: ["from_company_id", "to_company_id", "terms"],
        },
      },
      {
        name: "accept_deal",
        description:
          "Accept a proposal. Call once from each side (proposer and recipient). When both have accepted, the deal is made and both users receive an email.",
        inputSchema: {
          type: "object" as const,
          properties: {
            proposal_id: {
              type: "string",
              description: "Id returned from propose",
            },
            as_company_id: {
              type: "string",
              description: "Your company id (the one accepting)",
            },
          },
          required: ["proposal_id", "as_company_id"],
        },
      },
      {
        name: "get_proposal_status",
        description: "Get status of a proposal by id.",
        inputSchema: {
          type: "object" as const,
          properties: {
            proposal_id: { type: "string" },
          },
          required: ["proposal_id"],
        },
      },
    ];
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const parsed = typeof args === "string" ? JSON.parse(args || "{}") : args ?? {};

    let result: unknown;
    try {
      if (name === "list_bots") {
        result = await listBots();
      } else if (name === "propose") {
        result = await propose(parsed as Parameters<typeof propose>[0]);
      } else if (name === "accept_deal") {
        result = await acceptDeal(parsed as Parameters<typeof acceptDeal>[0]);
      } else if (name === "get_proposal_status") {
        result = await getProposalStatus(
          parsed as Parameters<typeof getProposalStatus>[0]
        );
      } else {
        result = { error: "Unknown tool: " + name };
      }
    } catch (err) {
      result = {
        error: err instanceof Error ? err.message : String(err),
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runMcpServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
