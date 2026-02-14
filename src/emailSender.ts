import nodemailer from "nodemailer";
import { Resend } from "resend";
import { config } from "./config.js";

const useResend = (): boolean => Boolean(config.RESEND_API_KEY?.trim());

async function sendViaResend(
  _from: string,
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  const resend = new Resend(config.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: config.EMAIL_FROM,
    to: [to],
    subject,
    text,
    html: html ?? undefined,
  });
  if (error) throw new Error(String(error.message));
}

export interface DealEmailParams {
  toEmail: string;
  toCompanyName: string;
  counterpartyName: string;
  summary: string;
  terms: Record<string, unknown>;
}

export interface ProposalNotificationParams {
  toEmail: string;
  proposalId: string;
  fromCompanyName: string;
  fromCompanyId: string;
  toCompanyName: string;
  toCompanyId: string;
  terms: Record<string, unknown>;
}

function getTransporter(): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth:
      config.SMTP_USER && config.SMTP_PASSWORD
        ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
        : undefined,
  });
}

export async function sendDealEmail(params: DealEmailParams): Promise<void> {
  const { toEmail, toCompanyName, counterpartyName, summary, terms } = params;
  const text = [
    `A deal has been made involving ${toCompanyName}.`,
    "",
    `Counterparty: ${counterpartyName}`,
    "",
    "Summary:",
    summary,
    "",
    "Agreed terms:",
    JSON.stringify(terms, null, 2),
  ].join("\n");
  const from = config.SMTP_FROM || config.SMTP_USER || config.EMAIL_FROM || "noreply@local";
  const subject = `Deal confirmed: ${toCompanyName} and ${counterpartyName}`;

  if (useResend()) {
    await sendViaResend(from, toEmail, subject, text);
    return;
  }
  const transporter = getTransporter();
  await transporter.sendMail({ from, to: toEmail, subject, text });
}

function formatTermsForDisplay(terms: Record<string, unknown>): string {
  return Object.entries(terms)
    .map(([key, value]) => {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const val = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
      return `${label}: ${val}`;
    })
    .join("\n");
}

function formatProposalDocument(params: ProposalNotificationParams): string {
  const termsBlock = formatTermsForDisplay(params.terms);
  return [
    "Hello,",
    "",
    `This email confirms that a deal has been agreed between ${params.fromCompanyName} and ${params.toCompanyName}.`,
    "",
    "PROPOSAL SUMMARY",
    "----------------",
    "",
    `Reference: ${params.proposalId}`,
    "",
    "Parties:",
    `  Proposer: ${params.fromCompanyName}`,
    `  Counterparty: ${params.toCompanyName}`,
    "",
    "Agreed terms:",
    termsBlock,
    "",
    "Please retain this email for your records. If you have any questions, please contact the parties directly.",
    "",
    "Best regards,",
    "Deal Notification",
  ].join("\n");
}

function formatProposalDocumentHtml(params: ProposalNotificationParams): string {
  const termsRows = Object.entries(params.terms)
    .map(([key, value]) => {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const val = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
      return `    <tr><td style="padding:8px 12px 8px 0;color:#555;font-weight:500;">${escapeHtml(label)}</td><td style="padding:8px 0;">${escapeHtml(val)}</td></tr>`;
    })
    .join("\n");
  const termsTable =
    termsRows.length > 0
      ? `<table style="border-collapse:collapse;margin:12px 0;">${termsRows}</table>`
      : "<p style='margin:12px 0;color:#666;'>No additional terms.</p>";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.5;color:#222;max-width:560px;margin:0 auto;padding:24px;">
  <p style="margin:0 0 20px;">Hello,</p>
  <p style="margin:0 0 20px;">This email confirms that a deal has been agreed between <strong>${escapeHtml(params.fromCompanyName)}</strong> and <strong>${escapeHtml(params.toCompanyName)}</strong>.</p>
  <div style="border:1px solid #e0e0e0;border-radius:6px;padding:20px;margin:24px 0;background:#fafafa;">
    <p style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">Proposal summary</p>
    <p style="margin:0 0 16px;"><strong>Reference:</strong> ${escapeHtml(params.proposalId)}</p>
    <p style="margin:0 0 8px;"><strong>Proposer:</strong> ${escapeHtml(params.fromCompanyName)}</p>
    <p style="margin:0 0 16px;"><strong>Counterparty:</strong> ${escapeHtml(params.toCompanyName)}</p>
    <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">Agreed terms</p>
    ${termsTable}
  </div>
  <p style="margin:20px 0 0;color:#555;font-size:14px;">Please retain this email for your records. If you have any questions, please contact the parties directly.</p>
  <p style="margin:24px 0 0;">Best regards,<br>Deal Notification</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getProposalNotificationMail(params: ProposalNotificationParams): {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
} {
  return {
    from: config.SMTP_FROM || config.SMTP_USER || config.EMAIL_FROM || "noreply@local",
    to: params.toEmail,
    subject: `Deal reached: ${params.fromCompanyName} and ${params.toCompanyName}`,
    text: formatProposalDocument(params),
    html: formatProposalDocumentHtml(params),
  };
}

export async function sendProposalNotification(
  params: ProposalNotificationParams,
  transporter?: nodemailer.Transporter
): Promise<void> {
  if (!params.toEmail.trim()) return;
  const mail = getProposalNotificationMail(params);
  if (useResend() && !transporter) {
    await sendViaResend(mail.from, mail.to, mail.subject, mail.text, mail.html);
    return;
  }
  const transport = transporter ?? getTransporter();
  await transport.sendMail({
    from: mail.from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}
