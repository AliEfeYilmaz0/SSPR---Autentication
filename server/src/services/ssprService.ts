import { User } from "../models/User";
import { ResetRequest } from "../models/ResetRequest";
import { PushChallenge } from "../models/PushChallenge";
import { EmailOtp } from "../models/EmailOtp";
import { auditService } from "./auditService";
import { otpService } from "./otpService";
import { RequestContext } from "../types/requestContext";
import { flowTimeoutService } from "./flowTimeoutService";
import { env } from "../config/env";

const PUSH_EXPIRY_MS = 30_000;
const FLOW_TIMEOUT_MS = env.flowTimeoutSeconds * 1000;

const normalizeIdentifier = (value: string) => value.trim().toLowerCase();

export const ssprService = {
  requestReset: async (input: {
    usernameOrEmail: string;
    requestContext?: RequestContext;
  }) => {
    const usernameOrEmail = normalizeIdentifier(input.usernameOrEmail);

    const user = await User.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    });

    const resetRequest = await ResetRequest.create({
      userId: user?._id,
      usernameOrEmail,
      status: "PENDING",
      verificationMethod: user ? "PUSH" : "NONE",
      attemptCount: 0,
      lastActivityAt: new Date(),
      authFlowExpiresAt: new Date(Date.now() + FLOW_TIMEOUT_MS),
    });

    await auditService.logEvent({
      userId: user?._id,
      usernameOrEmail,
      eventType: "reset_requested",
      status: "PENDING",
      result: "SUCCESS",
      message: "Password reset requested",
      metadata: { resetRequestId: resetRequest._id },
      requestContext: input.requestContext,
    });

    if (!user) {
      await auditService.logEvent({
        usernameOrEmail,
        eventType: "user_not_found",
        status: "NOT_FOUND",
        result: "FAILURE",
        message: "Password reset requested for unknown user",
        metadata: { resetRequestId: resetRequest._id },
        requestContext: input.requestContext,
      });
      return { resetRequestId: resetRequest._id.toString() };
    }

    const pushChallenge = await PushChallenge.create({
      resetRequestId: resetRequest._id,
      status: "PENDING",
      expiresAt: new Date(Date.now() + PUSH_EXPIRY_MS),
    });

    resetRequest.pushChallengeId = pushChallenge._id;
    resetRequest.lastActivityAt = new Date();
    await resetRequest.save();

    await auditService.logEvent({
      userId: user._id,
      usernameOrEmail,
      eventType: "user_found",
      status: "FOUND",
      result: "SUCCESS",
      message: "User found for password reset",
      metadata: { resetRequestId: resetRequest._id },
      requestContext: input.requestContext,
    });

    await auditService.logEvent({
      userId: user._id,
      usernameOrEmail,
      eventType: "push_challenge_created",
      status: "PENDING",
      result: "SUCCESS",
      message: "Push challenge created",
      metadata: {
        resetRequestId: resetRequest._id,
        challengeId: pushChallenge._id,
        expiresAt: pushChallenge.expiresAt,
      },
      requestContext: input.requestContext,
    });

    return { resetRequestId: resetRequest._id.toString() };
  },

  getStatus: async (input: {
    resetRequestId: string;
    requestContext?: RequestContext;
  }) => {
    const resetRequest = await flowTimeoutService.ensureAuthFlowTimeout({
      resetRequestId: input.resetRequestId,
      requestContext: input.requestContext,
    });
    if (!resetRequest) {
      return {
        success: false,
        statusCode: 404,
        error: { code: "NOT_FOUND", message: "Reset request not found" },
      } as const;
    }

    await otpService.handlePushTimeout({
      resetRequestId: resetRequest._id.toString(),
      requestContext: input.requestContext,
    });

    const refreshedResetRequest = await flowTimeoutService.ensureResetFlowTimeout({
      resetRequestId: resetRequest._id.toString(),
      requestContext: input.requestContext,
    });
    if (!refreshedResetRequest) {
      return {
        success: false,
        statusCode: 404,
        error: { code: "NOT_FOUND", message: "Reset request not found" },
      } as const;
    }

    const pushChallenge = refreshedResetRequest.pushChallengeId
      ? await PushChallenge.findById(refreshedResetRequest.pushChallengeId)
      : null;

    const emailOtp = refreshedResetRequest.otpId
      ? await EmailOtp.findById(refreshedResetRequest.otpId)
      : await EmailOtp.findOne({ resetRequestId: refreshedResetRequest._id }).sort({
          createdAt: -1,
        });

    const now = Date.now();
    const cooldownMs = otpService.getCooldownMs();
    const resendAvailableAt =
      emailOtp?.sentAt ? new Date(emailOtp.sentAt.getTime() + cooldownMs) : null;

    let nextStep:
      | "WAITING_APPROVAL"
      | "APPROVED"
      | "DENIED"
      | "OTP_REQUIRED"
      | "OTP_VERIFIED"
      | "RESET_ALLOWED"
      | "COMPLETED" = "WAITING_APPROVAL";

    const tokenValid =
      Boolean(refreshedResetRequest.resetTokenJti) &&
      (!refreshedResetRequest.resetTokenExpiresAt ||
        refreshedResetRequest.resetTokenExpiresAt > new Date());

    switch (refreshedResetRequest.status) {
      case "PUSH_APPROVED":
        nextStep = tokenValid ? "RESET_ALLOWED" : "APPROVED";
        break;
      case "PUSH_DENIED":
      case "FAILED":
        nextStep = "DENIED";
        break;
      case "OTP_PENDING":
      case "PUSH_TIMED_OUT":
        nextStep = "OTP_REQUIRED";
        break;
      case "OTP_VERIFIED":
        nextStep = tokenValid ? "RESET_ALLOWED" : "OTP_VERIFIED";
        break;
      case "COMPLETED":
        nextStep = "COMPLETED";
        break;
      case "PENDING":
      default:
        nextStep = "WAITING_APPROVAL";
        break;
    }

    return {
      success: true,
      data: {
        nextStep,
        resetTokenIssued: tokenValid,
        flowExpired: refreshedResetRequest.failureReason === "AUTH_TIMEOUT" || refreshedResetRequest.failureReason === "RESET_TIMEOUT",
        failureReason: refreshedResetRequest.failureReason,
        authFlowExpiresAt: refreshedResetRequest.authFlowExpiresAt ?? null,
        resetFlowExpiresAt: refreshedResetRequest.resetFlowExpiresAt ?? null,
        pushExpiresAt:
          nextStep === "WAITING_APPROVAL" ? pushChallenge?.expiresAt ?? null : null,
        otpExpiresAt:
          nextStep === "OTP_REQUIRED" ? emailOtp?.expiresAt ?? null : null,
        resendAvailableAt:
          nextStep === "OTP_REQUIRED" && resendAvailableAt && now < resendAvailableAt.getTime()
            ? resendAvailableAt
            : nextStep === "OTP_REQUIRED"
            ? new Date()
            : null,
      },
    } as const;
  },
};
