import type { ApiPayload } from "../src/models.js";
import { normalizeToContext, writeContextFile } from "../src/fetcher.js";

const DUMMY_COMPANIES: ApiPayload[] = [
  {
    id: "dummy-company-alpha",
    email: "alpha@example.com",
    company_name: "Alpha Consulting",
    short_term_goals: ["Close 3 partnerships this quarter", "Launch new advisory service"],
    long_term_goals: ["Become top-5 in the region", "Expand to two new domains"],
    domains: ["consulting", "strategy", "advisory"],
    policies: ["No exclusivity beyond 12 months", "Payment net-30 only"],
    pricing_model: "Retainer + success fee",
    services: ["Strategy workshops", "Due diligence", "Integration support"],
    source: "dummy",
  },
  {
    id: "dummy-company-beta",
    email: "beta@example.com",
    company_name: "Beta Labs",
    short_term_goals: ["Ship API v2", "Onboard 10 pilot customers"],
    long_term_goals: ["Open-source core stack", "Reach 100 enterprise customers"],
    domains: ["SaaS", "developer-tools", "APIs"],
    policies: ["No custom one-off contracts under 6 months", "SLAs only for enterprise tier"],
    pricing_model: "Usage-based + enterprise flat fee",
    services: ["API access", "Dedicated support", "Custom integrations"],
    source: "dummy",
  },
  {
    id: "dummy-company-gamma",
    email: "gamma@example.com",
    company_name: "Gamma Logistics",
    short_term_goals: ["Reduce last-mile cost by 15%", "Sign one regional carrier"],
    long_term_goals: ["Expand to two new regions", "Full visibility API for all partners"],
    domains: ["logistics", "shipping", "warehousing"],
    policies: ["Liability caps per contract", "Insurance requirements for carriers"],
    pricing_model: "Per-shipment + volume tiers",
    services: ["Freight booking", "Tracking", "Warehouse API"],
    source: "dummy",
  },
  {
    id: "dummy-company-delta",
    email: "delta@example.com",
    company_name: "Delta Media",
    short_term_goals: ["Launch newsletter product", "Hit 50k subscribers"],
    long_term_goals: ["Build owned-audience platform", "Monetize via events and sponsors"],
    domains: ["media", "newsletter", "content"],
    policies: ["No paid coverage without disclosure", "Editorial independence in contracts"],
    pricing_model: "Sponsorship + CPM",
    services: ["Sponsored posts", "Newsletter placements", "Event partnerships"],
    source: "dummy",
  },
  {
    id: "dummy-company-epsilon",
    email: "epsilon@example.com",
    company_name: "Epsilon Security",
    short_term_goals: ["Complete SOC2 Type II", "Add 5 enterprise pilots"],
    long_term_goals: ["FedRAMP readiness", "Expand to EU market"],
    domains: ["security", "compliance", "infrastructure"],
    policies: ["NDA required before technical details", "No liability for client misconfiguration"],
    pricing_model: "Annual subscription + professional services",
    services: ["Audit support", "Pen testing", "Compliance automation"],
    source: "dummy",
  },
];

async function main(): Promise<void> {
  for (const raw of DUMMY_COMPANIES) {
    const ctx = normalizeToContext(raw, raw.id as string);
    const filePath = await writeContextFile(ctx);
    console.log(`Wrote ${ctx.company_name} -> ${filePath}`);
  }
  console.log(`Done. Seeded ${DUMMY_COMPANIES.length} dummy company context(s).`);
  console.log("Run list_bots via MCP or generate-souls to use them.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
