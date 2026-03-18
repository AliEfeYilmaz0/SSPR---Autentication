import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";

export type ResetTokenPayload = {
  userId: string;
  resetRequestId: string;
  purpose: "password_reset";
  jti: string;
};

const parseExpiresInMs = (value: string): number => {
  if (!value) return 10 * 60 * 1000;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const match = trimmed.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return 10 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return 10 * 60 * 1000;
  }
};

export const resetTokenService = {
  signResetToken: (input: { userId: string; resetRequestId: string }) => {
    const jti = crypto.randomUUID();
    const payload: ResetTokenPayload = {
      userId: input.userId,
      resetRequestId: input.resetRequestId,
      purpose: "password_reset",
      jti,
    };

    const token = jwt.sign(payload, env.jwtResetSecret, {
      expiresIn: env.jwtResetExpiresIn,
    });

    const expiresAt = new Date(Date.now() + parseExpiresInMs(env.jwtResetExpiresIn));

    return { token, jti, expiresAt };
  },

  verifyResetToken: (token: string) => {
    try {
      const decoded = jwt.verify(token, env.jwtResetSecret) as ResetTokenPayload;
      if (!decoded || decoded.purpose !== "password_reset") {
        return { valid: false, reason: "INVALID_PURPOSE" } as const;
      }
      return { valid: true, payload: decoded } as const;
    } catch (error: any) {
      if (error?.name === "TokenExpiredError") {
        return { valid: false, reason: "EXPIRED" } as const;
      }
      return { valid: false, reason: "INVALID" } as const;
    }
  },
};
