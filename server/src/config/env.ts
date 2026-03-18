import dotenv from "dotenv";

dotenv.config();

const requireEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  mongoUri: requireEnv("MONGODB_URI"),
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "no-reply@example.com",
  jwtResetSecret: requireEnv("JWT_RESET_SECRET", "dev-reset-secret"),
  jwtResetExpiresIn: process.env.JWT_RESET_EXPIRES_IN ?? "10m",
  flowTimeoutSeconds: Number(process.env.FLOW_TIMEOUT_SECONDS ?? 180),
};

export const isDev = env.nodeEnv !== "production";
