# Valentine Hack – Multi-Agent Deal System (Blaxel + TypeScript)

System that fetches company data from an Onboarding API, persists context files, runs a **deal API** (list_bots, propose, accept_deal, get_proposal_status), and deploys one **deal agent per company on Blaxel**. Agents call the deal API to negotiate; when both parties accept a proposal, both companies receive a deal email.

## Plan features (mapped to code)

| Plan feature | Implementation |
| --- | --- |
| **1. Data from Onboarding API** | `src/fetcher.ts` + `scripts/fetchOnboarding.ts` – fetch JSON, persist to `data/contexts/<id>.json`. |
| **2. Context file** | `src/models.ts` – `CompanyContext`; context files written by fetcher. |
| **3. Deal API** | `src/dealApiServer.ts` – HTTP server exposing `list_bots`, `propose`, `accept_deal`, `get_proposal_status` (uses `src/dealToolsCore.ts`). |
| **4. Deal agents on Blaxel** | One Blaxel sandbox per company (`blaxel-agent-app/server.js`). Each agent has `COMPANY_ID` and `DEAL_API_URL`, proxies deal requests to the central API. |
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
- **Deal API server** – `npm run deal-api` – starts the HTTP deal API (port 3780). Agents and MCP clients call this to list bots, propose, accept, get status.
- **MCP server (stdio)** – `npm run mcp-server` – MCP tools for Cursor etc.; uses same deal logic as deal API.
- **Generate Blaxel deployments** – `npm run generate-blaxel-deployments` – one Blaxel sandbox folder per company under `blaxel-deployments/<id>/`. Deploy with `bl deploy -d blaxel-deployments/<id>`.

## Running the multi-agent deal flow

1. **Contexts** – Run `npm run fetch-onboarding` or `npm run seed-dummy`.
2. **Deal API** – Start the central deal API so agents can call it: `npm run deal-api`. Expose it at a URL Blaxel can reach (e.g. ngrok or a hosted URL). Set `DEAL_API_URL` for each Blaxel deployment to that URL.
3. **Generate Blaxel deployments** – `npm run generate-blaxel-deployments`.
4. **Set DEAL_API_URL** – In each `blaxel-deployments/<id>/blaxel.toml` set `DEAL_API_URL = "https://your-deal-api-url"`, or set it in the Blaxel console for each sandbox.
5. **Deploy agents** – From WSL (or Mac/Linux): `bl login`, then for each company `bl deploy -d blaxel-deployments/<agent-id>`.
6. **Negotiate** – Call each agent’s `/deal` endpoint (POST with `{ "method": "list_bots" }`, `"propose"`, `"accept_deal"`, `"get_proposal_status" }` and `params`). Agents use `COMPANY_ID` when proposing or accepting. When both parties accept the same proposal, the deal is made and both emails receive a notification.

## Data and flow

- **Context** (`data/contexts/<id>.json`): id, email, company_name, domains, policies, pricing_model, services, goals.
- **Deal API**: Single HTTP server; in-memory proposals; when both accept, `dealHandler` sends emails.
- **Blaxel agents**: One sandbox per company; each runs `blaxel-agent-app/server.js` with `COMPANY_ID` and `DEAL_API_URL`, forwarding deal calls to the deal API.

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
- `blaxel-agent-app/server.js` – minimal deal agent (calls deal API; runs on Blaxel)
- `scripts/generateBlaxelDeployments.ts` – CLI for generate-blaxel-deployments
- `scripts/fetchOnboarding.ts` – CLI for fetch-onboarding
- `src/scripts/generateSouls.ts` – CLI for generate-souls
