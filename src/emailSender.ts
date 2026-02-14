import nodemailer from "nodemailer";
import { config } from "./config.js";

export interface DealEmailParams {
  toEmail: string;
  toCompanyName: string;
  counterpartyName: string;
  summary: string;
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
  const transporter = getTransporter();
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

  await transporter.sendMail({
    from: config.SMTP_FROM || config.SMTP_USER || "noreply@local",
    to: toEmail,
    subject: `Deal confirmed: ${toCompanyName} and ${counterpartyName}`,
    text,
  });
}
