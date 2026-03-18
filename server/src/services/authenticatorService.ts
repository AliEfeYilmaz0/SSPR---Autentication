import { Types } from "mongoose";
import { PushChallenge } from "../models/PushChallenge";
import { ResetRequest } from "../models/ResetRequest";
import { auditService } from "./auditService";
import { resetTokenService } from "./resetTokenService";
import { RequestContext } from "../types/requestContext";
import { flowTimeoutService } from "./flowTimeoutService";
import { env } from "../config/env";

type ServiceResult =
  | { success: true; message: string; data: Record<string, unknown> }
  | {
      success: false;
      statusCode: number;
      error: { code: string; message: string };
      message?: string;
      data?: Record<string, unknown>;
    };

const isExpired = (expiresAt: Date) => Date.now() > expiresAt.getTime();
const FLOW_TIMEOUT_MS = env.flowTimeoutSeconds * 1000;

const markTimedOut = async (challengeId: Types.ObjectId) => {
  const challenge = await PushChallenge.findById(challengeId);
  if (!challenge || challenge.status !== "PENDING") return challenge;

  challenge.status = "TIMED_OUT";
  await challenge.save();

  await ResetRequest.updateOne(
    { _id: challenge.resetRequestId },
    {
      $set: {
        status: "PUSH_TIMED_OUT",
        verificationMethod: "EMAIL_OTP",
        lastActivityAt: new Date(),
      },
    }
  );

  return challenge;
};

export const authenticatorService = {
  getPending: async () => {
    const now = new Date();
    const challenges = await PushChallenge.find({
      status: "PENDING",
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const resetRequestIds = challenges.map((c) => c.resetRequestId);
    const resetRequests = await ResetRequest.find({ _id: { $in: resetRequestIds } })
      .select("usernameOrEmail")
      .lean();

    const resetRequestMap = new Map(
      resetRequests.map((rr) => [String(rr._id), rr])
    );

    return challenges.map((challenge) => ({
      challengeId: challenge._id,
      resetRequestId: challenge.resetRequestId,
      usernameOrEmail: resetRequestMap.get(String(challenge.resetRequestId))?.usernameOrEmail,
      expiresAt: challenge.expiresAt,
      createdAt: challenge.createdAt,
    }));
  },

  approveChallenge: async (input: {
    challengeId: string;
    requestContext?: RequestContext;
  }): Promise<ServiceResult> => {
    const challenge = await PushChallenge.findById(input.challengeId);

    if (!challenge) {
      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "NOT_FOUND",
        result: "FAILURE",
        message: "Approve requested for missing challenge",
        metadata: { challengeId: input.challengeId },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 404,
        error: { code: "NOT_FOUND", message: "Challenge not found" },
      };
    }

    if (challenge.status === "APPROVED") {
      await auditService.logEvent({
        eventType: "duplicate_action",
        status: "ALREADY_APPROVED",
        result: "SUCCESS",
        message: "Duplicate approve ignored",
        metadata: { challengeId: challenge._id },
        requestContext: input.requestContext,
      });

      return {
        success: true,
        message: "Challenge already approved",
        data: { challengeId: challenge._id },
      };
    }

    if (challenge.status === "DENIED") {
      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "ALREADY_DENIED",
        result: "FAILURE",
        message: "Approve attempted on denied challenge",
        metadata: { challengeId: challenge._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 409,
        error: { code: "ALREADY_DENIED", message: "Challenge already denied" },
      };
    }

    if (challenge.status === "TIMED_OUT") {
      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "TIMED_OUT",
        result: "FAILURE",
        message: "Approve attempted on timed-out challenge",
        metadata: { challengeId: challenge._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 409,
        error: { code: "EXPIRED", message: "Challenge expired" },
      };
    }

    if (isExpired(challenge.expiresAt)) {
      await markTimedOut(challenge._id);
      await auditService.logEvent({
        eventType: "push_timed_out",
        status: "EXPIRED",
        result: "FAILURE",
        message: "Challenge expired before approval",
        metadata: { challengeId: challenge._id },
        requestContext: input.requestContext,
      });

      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "EXPIRED",
        result: "FAILURE",
        message: "Approve attempted on expired challenge",
        metadata: { challengeId: challenge._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 409,
        error: { code: "EXPIRED", message: "Challenge expired" },
      };
    }

    challenge.status = "APPROVED";
    challenge.approvedAt = new Date();
    await challenge.save();

    await ResetRequest.updateOne(
      { _id: challenge.resetRequestId },
      {
        $set: {
          status: "PUSH_APPROVED",
          verificationMethod: "PUSH",
          lastActivityAt: new Date(),
        },
      }
    );

    const timeoutCheck = await flowTimeoutService.ensureAuthFlowTimeout({
      resetRequestId: challenge.resetRequestId.toString(),
      requestContext: input.requestContext,
    });

    if (!timeoutCheck || timeoutCheck.status === "FAILED") {
      return {
        success: false,
        statusCode: 409,
        error: { code: "FLOW_TIMEOUT", message: "Reset flow timed out" },
      };
    }

    await auditService.logEvent({
      eventType: "push_approved",
      status: "APPROVED",
      result: "SUCCESS",
      message: "Push challenge approved",
      metadata: { challengeId: challenge._id, resetRequestId: challenge.resetRequestId },
      requestContext: input.requestContext,
    });

    const resetRequest = await ResetRequest.findById(challenge.resetRequestId);
    if (resetRequest && resetRequest.userId) {
      const tokenResult = resetTokenService.signResetToken({
        userId: resetRequest.userId.toString(),
        resetRequestId: resetRequest._id.toString(),
      });

      resetRequest.resetTokenJti = tokenResult.jti;
      resetRequest.resetTokenExpiresAt = tokenResult.expiresAt;
      resetRequest.resetFlowExpiresAt = new Date(Date.now() + FLOW_TIMEOUT_MS);
      await resetRequest.save();

      await auditService.logEvent({
        eventType: "reset_token_issued",
        status: "ISSUED",
        result: "SUCCESS",
        message: "Reset token issued after push approval",
        metadata: {
          resetRequestId: resetRequest._id,
          userId: resetRequest.userId,
          expiresAt: tokenResult.expiresAt,
        },
        requestContext: input.requestContext,
      });

      return {
        success: true,
        message: "Challenge approved",
        data: {
          challengeId: challenge._id,
          resetToken: tokenResult.token,
          resetTokenExpiresAt: tokenResult.expiresAt,
        },
      };
    }

    await auditService.logEvent({
      eventType: "reset_flow_failed",
      status: "NO_USER",
      result: "FAILURE",
      message: "Reset token could not be issued after approval",
      metadata: { resetRequestId: challenge.resetRequestId },
      requestContext: input.requestContext,
    });

    return {
      success: true,
      message: "Challenge approved",
      data: { challengeId: challenge._id },
    };
  },

  denyChallenge: async (input: {
    challengeId: string;
    requestContext?: RequestContext;
  }): Promise<ServiceResult> => {
    const challenge = await PushChallenge.findById(input.challengeId);

    if (!challenge) {
      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "NOT_FOUND",
        result: "FAILURE",
        message: "Deny requested for missing challenge",
        metadata: { challengeId: input.challengeId },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 404,
        error: { code: "NOT_FOUND", message: "Challenge not found" },
      };
    }

    if (challenge.status === "DENIED") {
      await auditService.logEvent({
        eventType: "duplicate_action",
        status: "ALREADY_DENIED",
        result: "SUCCESS",
        message: "Duplicate deny ignored",
        metadata: { challengeId: challenge._id },
        requestContext: input.requestContext,
      });

      return {
        success: true,
        message: "Challenge already denied",
        data: { challengeId: challenge._id },
      };
    }

    if (challenge.status === "APPROVED") {
      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "ALREADY_APPROVED",
        result: "FAILURE",
        message: "Deny attempted on approved challenge",
        metadata: { challengeId: challenge._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 409,
        error: { code: "ALREADY_APPROVED", message: "Challenge already approved" },
      };
    }

    if (challenge.status === "TIMED_OUT") {
      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "TIMED_OUT",
        result: "FAILURE",
        message: "Deny attempted on timed-out challenge",
        metadata: { challengeId: challenge._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 409,
        error: { code: "EXPIRED", message: "Challenge expired" },
      };
    }

    if (isExpired(challenge.expiresAt)) {
      await markTimedOut(challenge._id);
      await auditService.logEvent({
        eventType: "push_timed_out",
        status: "EXPIRED",
        result: "FAILURE",
        message: "Challenge expired before denial",
        metadata: { challengeId: challenge._id },
        requestContext: input.requestContext,
      });

      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "EXPIRED",
        result: "FAILURE",
        message: "Deny attempted on expired challenge",
        metadata: { challengeId: challenge._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 409,
        error: { code: "EXPIRED", message: "Challenge expired" },
      };
    }

    challenge.status = "DENIED";
    challenge.deniedAt = new Date();
    await challenge.save();

    await ResetRequest.updateOne(
      { _id: challenge.resetRequestId },
      {
        $set: {
          status: "PUSH_DENIED",
          verificationMethod: "PUSH",
          lastActivityAt: new Date(),
        },
      }
    );

    const timeoutCheck = await flowTimeoutService.ensureAuthFlowTimeout({
      resetRequestId: challenge.resetRequestId.toString(),
      requestContext: input.requestContext,
    });

    if (!timeoutCheck || timeoutCheck.status === "FAILED") {
      return {
        success: false,
        statusCode: 409,
        error: { code: "FLOW_TIMEOUT", message: "Reset flow timed out" },
      };
    }

    await auditService.logEvent({
      eventType: "push_denied",
      status: "DENIED",
      result: "SUCCESS",
      message: "Push challenge denied",
      metadata: { challengeId: challenge._id, resetRequestId: challenge.resetRequestId },
      requestContext: input.requestContext,
    });

    return {
      success: true,
      message: "Challenge denied",
      data: { challengeId: challenge._id },
    };
  },
};
