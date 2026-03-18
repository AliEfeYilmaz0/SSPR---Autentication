import { ResetRequest } from "../models/ResetRequest";
import { PushChallenge } from "../models/PushChallenge";
import { auditService } from "./auditService";
import { env } from "../config/env";
import { RequestContext } from "../types/requestContext";

const FLOW_TIMEOUT_MS = env.flowTimeoutSeconds * 1000;

const isExpired = (expiresAt?: Date) => {
  if (!expiresAt) return false;
  return Date.now() > expiresAt.getTime();
};

const markFailed = async (input: {
  resetRequestId: string;
  reason: "AUTH_TIMEOUT" | "RESET_TIMEOUT";
  requestContext?: RequestContext;
}) => {
  const resetRequest = await ResetRequest.findById(input.resetRequestId);
  if (!resetRequest || resetRequest.status === "FAILED" || resetRequest.status === "COMPLETED") {
    return resetRequest;
  }

  resetRequest.status = "FAILED";
  resetRequest.failureReason = input.reason;
  resetRequest.lastActivityAt = new Date();
  if (input.reason === "RESET_TIMEOUT") {
    resetRequest.resetTokenJti = undefined;
    resetRequest.resetTokenExpiresAt = undefined;
  }
  await resetRequest.save();

  await auditService.logEvent({
    eventType: "reset_flow_failed",
    status: input.reason,
    result: "FAILURE",
    message: "Reset flow timed out",
    metadata: { resetRequestId: resetRequest._id, reason: input.reason },
    requestContext: input.requestContext,
  });

  return resetRequest;
};

export const flowTimeoutService = {
  getFlowTimeoutMs: () => FLOW_TIMEOUT_MS,

  ensureAuthFlowTimeout: async (input: {
    resetRequestId: string;
    requestContext?: RequestContext;
  }) => {
    const resetRequest = await ResetRequest.findById(input.resetRequestId);
    if (!resetRequest) return null;

    if (
      resetRequest.status === "COMPLETED" ||
      resetRequest.status === "FAILED" ||
      resetRequest.status === "PUSH_APPROVED" ||
      resetRequest.status === "OTP_VERIFIED"
    ) {
      return resetRequest;
    }

    if (isExpired(resetRequest.authFlowExpiresAt)) {
      if (resetRequest.pushChallengeId) {
        await PushChallenge.updateOne(
          { _id: resetRequest.pushChallengeId, status: "PENDING" },
          { $set: { status: "TIMED_OUT" } }
        );
      }
      return await markFailed({
        resetRequestId: resetRequest._id.toString(),
        reason: "AUTH_TIMEOUT",
        requestContext: input.requestContext,
      });
    }

    return resetRequest;
  },

  ensureResetFlowTimeout: async (input: {
    resetRequestId: string;
    requestContext?: RequestContext;
  }) => {
    const resetRequest = await ResetRequest.findById(input.resetRequestId);
    if (!resetRequest) return null;

    if (resetRequest.status === "COMPLETED" || resetRequest.status === "FAILED") {
      return resetRequest;
    }

    if (isExpired(resetRequest.resetFlowExpiresAt)) {
      await auditService.logEvent({
        eventType: "reset_token_expired",
        status: "EXPIRED",
        result: "FAILURE",
        message: "Reset token expired due to flow timeout",
        metadata: { resetRequestId: resetRequest._id },
        requestContext: input.requestContext,
      });

      return await markFailed({
        resetRequestId: resetRequest._id.toString(),
        reason: "RESET_TIMEOUT",
        requestContext: input.requestContext,
      });
    }

    return resetRequest;
  },
};
