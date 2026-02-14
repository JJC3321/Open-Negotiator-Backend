import type { CompanyContext } from "./models.js";
import { sendDealEmail } from "./emailSender.js";

export interface DealMadePayload {
  proposalId: string;
  fromCompanyId: string;
  toCompanyId: string;
  terms: Record<string, unknown>;
}

export type OnDealMadeCallback = (payload: DealMadePayload) => Promise<void>;

export async function handleDealMade(
  payload: DealMadePayload,
  getContext: (id: string) => Promise<CompanyContext | null>
): Promise<void> {
  const fromCtx = await getContext(payload.fromCompanyId);
  const toCtx = await getContext(payload.toCompanyId);
  if (!fromCtx || !toCtx) {
    throw new Error(
      `Missing context for deal: from=${payload.fromCompanyId} to=${payload.toCompanyId}`
    );
  }
  const summary = `Deal between ${fromCtx.company_name} and ${toCtx.company_name}. Terms: ${JSON.stringify(payload.terms)}`;
  await sendDealEmail({
    toEmail: fromCtx.email,
    toCompanyName: fromCtx.company_name,
    counterpartyName: toCtx.company_name,
    summary,
    terms: payload.terms,
  });
  await sendDealEmail({
    toEmail: toCtx.email,
    toCompanyName: toCtx.company_name,
    counterpartyName: fromCtx.company_name,
    summary,
    terms: payload.terms,
  });
}
