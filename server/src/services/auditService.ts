import { Types } from "mongoose";
import { AuditLog, AuditLogResult } from "../models/AuditLog";
import { RequestContext } from "../types/requestContext";

type LogEventInput = {
  userId?: Types.ObjectId;
  usernameOrEmail?: string;
  eventType: string;
  status: string;
  result: AuditLogResult;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  requestContext?: RequestContext;
};

export const auditService = {
  logEvent: async (input: LogEventInput): Promise<void> => {
    const baseMetadata = input.metadata ?? {};
    const contextMetadata = input.requestContext
      ? {
          requestId: input.requestContext.requestId,
          ip: input.requestContext.ip,
          userAgent: input.requestContext.userAgent,
        }
      : {};

    const metadata = { ...baseMetadata, ...contextMetadata };

    try {
      await AuditLog.create({
        userId: input.userId,
        usernameOrEmail: input.usernameOrEmail,
        eventType: input.eventType,
        status: input.status,
        result: input.result,
        message: input.message,
        metadata,
        createdAt: input.createdAt ?? new Date(),
      });
    } catch (error) {
      console.error("[audit] failed to write audit log", error);
    }
  },
};
