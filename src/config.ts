import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDist = path.basename(path.dirname(__dirname)) === "dist";
const BASE_DIR = isDist ? path.resolve(__dirname, "..", "..") : path.resolve(__dirname, "..");

export const config = {
  ONBOARDING_API_URL: process.env.ONBOARDING_API_URL ?? "",
  ONBOARDING_API_KEY: process.env.ONBOARDING_API_KEY ?? "",
  BASE_DIR,
  DATA_DIR: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(BASE_DIR, "data"),
  CONTEXTS_DIR: process.env.CONTEXTS_DIR
    ? path.resolve(process.env.CONTEXTS_DIR)
    : path.join(BASE_DIR, "data", "contexts"),
  SOULS_DIR: process.env.SOULS_DIR
    ? path.resolve(process.env.SOULS_DIR)
    : path.join(BASE_DIR, "data", "souls"),
  SMTP_HOST: process.env.SMTP_HOST ?? "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT ?? "587", 10),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? "",
  SMTP_FROM: process.env.SMTP_FROM ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
  DEAL_PROPOSAL_NOTIFY_EMAIL: process.env.DEAL_PROPOSAL_NOTIFY_EMAIL ?? "johrishikhar123@gmail.com",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  MCP_TRANSPORT: process.env.MCP_TRANSPORT ?? "stdio",
} as const;
