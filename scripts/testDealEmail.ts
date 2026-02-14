/**
 * Test that the deal-reached proposal email is sent.
 *
 * Option 1 - Ethereal (no SMTP config): run as-is. Creates a fake inbox and
 *   prints a preview URL so you can see the email in the browser.
 *
 * Option 2 - Real SMTP: set SMTP_USER and SMTP_PASSWORD in .env, then run with
 *   USE_REAL_SMTP=1. The proposal email will be sent to DEAL_PROPOSAL_NOTIFY_EMAIL
 *   (default johrishikhar123@gmail.com).
 *
 * Usage:
 *   npx tsx scripts/testDealEmail.ts
 *   USE_REAL_SMTP=1 npx tsx scripts/testDealEmail.ts
 */

import nodemailer from "nodemailer";
import {
  sendProposalNotification,
  getProposalNotificationMail,
} from "../src/emailSender.js";

const USE_REAL_SMTP = process.env.USE_REAL_SMTP === "1" || process.env.USE_REAL_SMTP === "true";

const mockProposalParams = {
  toEmail: process.env.DEAL_PROPOSAL_NOTIFY_EMAIL ?? "johrishikhar123@gmail.com",
  proposalId: "test-proposal-" + Date.now(),
  fromCompanyName: "Alpha Consulting",
  fromCompanyId: "dummy-company-alpha",
  toCompanyName: "Beta Services",
  toCompanyId: "dummy-company-beta",
  terms: {
    scope: "Partnership for Q2",
    value: "50k",
    duration: "6 months",
  },
};

async function runWithEthereal(): Promise<void> {
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });

  const mail = getProposalNotificationMail({
    ...mockProposalParams,
    toEmail: testAccount.user,
  });
  const info = await transporter.sendMail({
    from: mail.from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log("Proposal email sent to Ethereal test account.");
  if (previewUrl) {
    console.log("Preview the email at:", previewUrl);
  } else {
    console.log("Mail result:", info);
  }
}

async function runWithRealSmtp(): Promise<void> {
  await sendProposalNotification(mockProposalParams);
  console.log(
    "Proposal email sent via SMTP to:",
    mockProposalParams.toEmail
  );
}

async function main(): Promise<void> {
  if (USE_REAL_SMTP) {
    await runWithRealSmtp();
  } else {
    await runWithEthereal();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
