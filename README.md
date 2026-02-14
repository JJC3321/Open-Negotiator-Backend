# Valentine Hack – Multi-Agent Deal System (Blaxel + TypeScript)

System that fetches company data from an Onboarding API, persists context files, and deploys one **P2P deal agent per company on Blaxel**. Agents talk to **each other directly** (propose and accept go agent-to-agent). When a deal is made, one agent calls a **deal webhook** (your deal API’s `/deal_made`) to send emails.

## Plan features (mapped to code)

| Plan feature | Implementation |
| --- | --- |
| **1. Data from Onboarding API** | `src/fetcher.ts` + `scripts/fetchOnboarding.ts` – fetch JSON, persist to `data/contexts/<id>.json`. |
| **2. Context file** | `src/models.ts` – `CompanyContext`; context files written by fetcher. |
| **3. Deal API** | `src/dealApiServer.ts` – HTTP server exposing `list_bots`, `propose`, `accept_deal`, `get_proposal_status` (uses `src/dealToolsCore.ts`). |
| **4. P2P deal agents on Blaxel** | One Blaxel sandbox per company (`blaxel-agent-app/server.js`). Each agent has `COMPANY_ID`, `AGENT_REGISTRY` (other agents’ URLs), and `DEAL_WEBHOOK_URL`. Agents send proposals/acceptances to each other; on deal made they POST to the webhook. |
| **5. When deal is made, send email** | `src/dealHandler.ts` + `src/emailSender.ts` – on both accept, email both companies. |

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set:
   - `ONBOARDING_API_URL` – onboarding API URL (or use dummy data: `npm run seed-dummy`)
   - `SMTP_*` – for deal notification emails
   - Optional: `DEAL_API_PORT` (default 3780)

## Scripts

- **Fetch onboarding** – `npm run fetch-onboarding` – writes context files under `data/contexts/`.
- **Seed dummy data** – `npm run seed-dummy` – writes dummy company contexts for testing.
- **Generate SOUL files (optional)** – `npm run generate-souls` – writes SOUL.md per company under `data/souls/`.
- **Deal API server** – `npm run deal-api` – serves `/deal` (for MCP/local use) and **`/deal_made`** (webhook: when a P2P deal completes, agents POST here to trigger emails).
- **MCP server (stdio)** – `npm run mcp-server` – MCP tools for Cursor etc.; uses same deal logic as deal API.
- **Generate Blaxel deployments** – `npm run generate-blaxel-deployments` – one Blaxel sandbox folder per company under `blaxel-deployments/<id>/`. Deploy with `bl deploy -d blaxel-deployments/<id>`.
- **Sync agent registry** – `npm run sync-agent-registry` – after deploying agents to Blaxel, fetches each sandbox's REST URL (via a public preview on port 3000) and writes `data/agent-registry.json`. Use that JSON as `AGENT_REGISTRY` in each sandbox so agents can talk to each other.

## Running the P2P multi-agent deal flow

1. **Contexts** – Run `npm run fetch-onboarding` or `npm run seed-dummy`.
2. **Deal webhook** – Run `npm run deal-api` and expose it (e.g. ngrok) so Blaxel can reach it. The **base URL + `/deal_made`** is your webhook (e.g. `https://abc.ngrok.io/deal_made`). The deal API uses this to load contexts and send emails when a deal completes.
3. **Generate Blaxel deployments** – `npm run generate-blaxel-deployments`. Optionally set `DEAL_WEBHOOK_URL` and `AGENT_REGISTRY` in `.env` before generating so `blaxel.toml` is pre-filled.
4. **Deploy agents** – Deploy each company: `bl deploy -d blaxel-deployments/<agent-id>`.
5. **Grab and store agent URLs** – Run `npm run sync-agent-registry` (after `bl login` or with `BL_API_KEY` and `BL_WORKSPACE` set). This uses the Blaxel API to fetch each sandbox, ensures a public preview on port 3000, and writes `data/agent-registry.json` with each agent's REST URL and company name. That file is the same shape as `AGENT_REGISTRY`.
6. **Configure each agent** – For each sandbox set:
   - **DEAL_WEBHOOK_URL** – Your deal API base URL + `/deal_made` (e.g. `https://abc.ngrok.io/deal_made`). Must be reachable from Blaxel.
   - **AGENT_REGISTRY** – Paste the contents of `data/agent-registry.json` (or the JSON string). Each agent's registry lists every other agent so they can call each other's `/receive_proposal` and `/proposal_accepted`.
7. **Negotiate** – Call any agent's `POST /deal` with `method: "list_bots"` (returns others from its registry), then `method: "propose"` (sender pushes the proposal to the other agent's `/receive_proposal`), then call the other agent's `/deal` with `method: "accept_deal"`, then the first agent's `/deal` with `method: "accept_deal"`. When both have accepted, one agent POSTs to `DEAL_WEBHOOK_URL` and both companies get emails.

## How P2P agents talk to each other

Agents **do not** use a central deal API for propose/accept:

- **list_bots** – Each agent returns the list from its `AGENT_REGISTRY` (other agents only).
- **propose** – Agent A creates a proposal and **POSTs it to Agent B's `/receive_proposal`**. Agent B stores it. Agent A returns the `proposal_id`.
- **accept_deal** – The accepting agent updates its local proposal and **POSTs to the other agent's `/proposal_accepted`** so both sides stay in sync. When the second party accepts, status becomes `accepted_by_both` and that agent **POSTs to DEAL_WEBHOOK_URL** (`/deal_made`) with the deal payload. Your deal API then runs `handleDealMade` (loads contexts, sends emails).

So you only need the deal API (or any server that exposes `POST /deal_made`) for **when a deal is completed** (emails). Proposals and acceptances go agent-to-agent.

## Data and flow

- **Context** (`data/contexts/<id>.json`): id, email, company_name, domains, policies, pricing_model, services, goals.
- **Deal API**: Serves `/deal` (for MCP/local) and **`/deal_made`** (webhook). When an agent POSTs a completed deal to `/deal_made`, the API loads contexts and sends emails.
- **Blaxel agents**: P2P; each runs `blaxel-agent-app/server.js` with `COMPANY_ID`, `AGENT_REGISTRY`, and `DEAL_WEBHOOK_URL`. Proposals and acceptances go between agents; only the final "deal made" hits the webhook.

## Project layout

- `src/config.ts` – env and paths (contexts, souls)
- `src/models.ts` – CompanyContext and API payload parsing
- `src/fetcher.ts` – fetch onboarding API, write context files
- `src/soulGenerator.ts` – SOUL.md content from context
- `src/dealToolsCore.ts` – deal logic (list_bots, propose, accept_deal, get_proposal_status)
- `src/dealApiServer.ts` – HTTP deal API server
- `src/dealHandler.ts` – on deal made, trigger emails
- `src/emailSender.ts` – send deal email via SMTP
- `src/mcpServer.ts` – MCP server (deal tools) for Cursor etc.
- `src/blaxel/deploymentGenerator.ts` – generate Blaxel deal-agent deployment folders
- `blaxel-agent-app/server.js` – P2P deal agent (talks to other agents; calls DEAL_WEBHOOK_URL when deal is made)
- `scripts/generateBlaxelDeployments.ts` – CLI for generate-blaxel-deployments
- `scripts/fetchOnboarding.ts` – CLI for fetch-onboarding
- `src/scripts/generateSouls.ts` – CLI for generate-souls
