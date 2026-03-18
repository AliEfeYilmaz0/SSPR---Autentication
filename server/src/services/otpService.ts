import bcrypt from "bcrypt";
import { Types } from "mongoose";
import { EmailOtp } from "../models/EmailOtp";
import { ResetRequest } from "../models/ResetRequest";
import { User } from "../models/User";
import { PushChallenge } from "../models/PushChallenge";
import { auditService } from "./auditService";
import { emailService } from "./emailService";
import { resetTokenService } from "./resetTokenService";
import { RequestContext } from "../types/requestContext";
import { generateOtp } from "../utils/otp";
import { isDev } from "../config/env";
import { flowTimeoutService } from "./flowTimeoutService";
import { env } from "../config/env";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_SALT_ROUNDS = 10;
const FLOW_TIMEOUT_MS = env.flowTimeoutSeconds * 1000;

const isExpired = (expiresAt: Date) => Date.now() > expiresAt.getTime();

const markPushTimedOut = async (resetRequestId: Types.ObjectId, challengeId: Types.ObjectId, requestContext?: RequestContext) => {
  await PushChallenge.updateOne(
    { _id: challengeId },
    { $set: { status: "TIMED_OUT" } }
  );

  await ResetRequest.updateOne(
    { _id: resetRequestId },
    {
      $set: {
        status: "PUSH_TIMED_OUT",
        verificationMethod: "EMAIL_OTP",
        lastActivityAt: new Date(),
      },
    }
  );

  await auditService.logEvent({
    eventType: "push_timed_out",
    status: "EXPIRED",
    result: "FAILURE",
    message: "Push challenge timed out",
    metadata: { resetRequestId, challengeId },
    requestContext,
  });
};

const invalidateExistingOtp = async (resetRequestId: Types.ObjectId) => {
  await EmailOtp.updateMany(
    { resetRequestId, status: "SENT" },
    { $set: { status: "EXPIRED" } }
  );
};

const buildOtpResponseData = (otp: string | null, expiresAt: Date | null) => {
  if (!isDev || !otp || !expiresAt) return {};
  return {
    otpPreview: otp,
    otpExpiresAt: expiresAt,
  };
};

export const otpService = {
  handlePushTimeout: async (input: {
    resetRequestId: string;
    requestContext?: RequestContext;
  }) => {
    const resetRequest = await flowTimeoutService.ensureAuthFlowTimeout({
      resetRequestId: input.resetRequestId,
      requestContext: input.requestContext,
    });
    if (!resetRequest || !resetRequest.pushChallengeId) return resetRequest;

    const pushChallenge = await PushChallenge.findById(resetRequest.pushChallengeId);
    if (!pushChallenge) return resetRequest;

    if (pushChallenge.status === "PENDING" && isExpired(pushChallenge.expiresAt)) {
      await markPushTimedOut(resetRequest._id, pushChallenge._id, input.requestContext);

      const updatedResetRequest = await ResetRequest.findById(resetRequest._id);
      if (updatedResetRequest) {
        await otpService.createAndSendOtp({
          resetRequest: updatedResetRequest,
          reason: "auto-timeout",
          requestContext: input.requestContext,
        });
      }
    }

    if (pushChallenge.status === "TIMED_OUT") {
      await otpService.ensureOtpAfterTimeout({
        resetRequestId: resetRequest._id,
        requestContext: input.requestContext,
      });
    }

    return await ResetRequest.findById(resetRequest._id);
  },
  ensureOtpAfterTimeout: async (input: {
    resetRequestId: Types.ObjectId;
    requestContext?: RequestContext;
  }): Promise<void> => {
    const resetRequest = await ResetRequest.findById(input.resetRequestId);
    if (!resetRequest) return;

    if (resetRequest.status === "OTP_PENDING" || resetRequest.status === "OTP_VERIFIED") {
      return;
    }

    if (resetRequest.status !== "PUSH_TIMED_OUT") {
      return;
    }

    const existingOtp = await EmailOtp.findOne({
      resetRequestId: resetRequest._id,
      status: "SENT",
    });

    if (existingOtp) return;

    await otpService.createAndSendOtp({
      resetRequest,
      reason: "auto-timeout",
      requestContext: input.requestContext,
    });
  },

  createAndSendOtp: async (input: {
    resetRequest: Awaited<ReturnType<typeof ResetRequest.findById>>;
    reason: "auto-timeout" | "resend";
    requestContext?: RequestContext;
  }) => {
    const resetRequest = input.resetRequest;
    if (!resetRequest) return { success: false } as const;

    const user = resetRequest.userId
      ? await User.findById(resetRequest.userId)
      : null;

    if (!user) {
      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "NO_USER",
        result: "FAILURE",
        message: "OTP creation failed due to missing user",
        metadata: { resetRequestId: resetRequest._id },
        requestContext: input.requestContext,
      });
      return { success: false } as const;
    }

    await invalidateExistingOtp(resetRequest._id);

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, OTP_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    const sentAt = new Date();

    const emailOtp = await EmailOtp.create({
      resetRequestId: resetRequest._id,
      otpHash,
      status: "SENT",
      attempts: 0,
      expiresAt,
      sentAt,
    });

    resetRequest.otpId = emailOtp._id;
    resetRequest.status = "OTP_PENDING";
    resetRequest.verificationMethod = "EMAIL_OTP";
    resetRequest.lastActivityAt = new Date();
    await resetRequest.save();

    try {
      await emailService.sendOtpEmail(user.email, otp);
    } catch (error) {
      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "EMAIL_SEND_FAILED",
        result: "FAILURE",
        message: "Failed to send OTP email",
        metadata: { resetRequestId: resetRequest._id, otpId: emailOtp._id },
        requestContext: input.requestContext,
      });
      throw error;
    }

    await auditService.logEvent({
      eventType: input.reason === "resend" ? "otp_resent" : "email_otp_sent",
      status: "SENT",
      result: "SUCCESS",
      message: input.reason === "resend" ? "OTP resent" : "OTP sent",
      metadata: { resetRequestId: resetRequest._id, otpId: emailOtp._id },
      requestContext: input.requestContext,
    });

    return {
      success: true,
      otp,
      expiresAt,
      data: buildOtpResponseData(otp, expiresAt),
    } as const;
  },

  resendOtp: async (input: {
    resetRequestId: string;
    requestContext?: RequestContext;
  }) => {
    await otpService.handlePushTimeout({
      resetRequestId: input.resetRequestId,
      requestContext: input.requestContext,
    });

    const resetRequest = await ResetRequest.findById(input.resetRequestId);
    if (!resetRequest) {
      return {
        success: false,
        statusCode: 404,
        error: { code: "NOT_FOUND", message: "Reset request not found" },
      } as const;
    }

    if (resetRequest.status === "PENDING") {
      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "PUSH_PENDING",
        result: "FAILURE",
        message: "OTP resend attempted before push timeout",
        metadata: { resetRequestId: resetRequest._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 409,
        error: { code: "PUSH_PENDING", message: "Push approval still pending" },
      } as const;
    }

    if (resetRequest.status === "OTP_VERIFIED") {
      await auditService.logEvent({
        eventType: "duplicate_action",
        status: "ALREADY_VERIFIED",
        result: "SUCCESS",
        message: "Resend attempted after OTP verified",
        metadata: { resetRequestId: resetRequest._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 409,
        error: { code: "ALREADY_VERIFIED", message: "OTP already verified" },
      } as const;
    }

    if (resetRequest.status === "FAILED" && resetRequest.failureReason === "AUTH_TIMEOUT") {
      return {
        success: false,
        statusCode: 409,
        error: { code: "FLOW_TIMEOUT", message: "Authentication flow timed out" },
      } as const;
    }

    if (resetRequest.status === "COMPLETED") {
      await auditService.logEvent({
        eventType: "duplicate_action",
        status: "COMPLETED",
        result: "SUCCESS",
        message: "Resend attempted on completed request",
        metadata: { resetRequestId: resetRequest._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 409,
        error: { code: "COMPLETED", message: "Reset already completed" },
      } as const;
    }

    const lastOtp = await EmailOtp.findOne({ resetRequestId: resetRequest._id })
      .sort({ createdAt: -1 })
      .lean();

    if (lastOtp) {
      const availableAt = new Date(lastOtp.sentAt.getTime() + OTP_RESEND_COOLDOWN_MS);
      if (Date.now() < availableAt.getTime()) {
        await auditService.logEvent({
          eventType: "too_many_attempts",
          status: "RESEND_COOLDOWN",
          result: "FAILURE",
          message: "OTP resend attempted too soon",
          metadata: { resetRequestId: resetRequest._id },
          requestContext: input.requestContext,
        });

        return {
          success: false,
          statusCode: 429,
          error: { code: "COOLDOWN", message: "Please wait before resending" },
          retryAfter: availableAt,
        } as const;
      }
    }

    const result = await otpService.createAndSendOtp({
      resetRequest,
      reason: "resend",
      requestContext: input.requestContext,
    });

    if (!result.success) {
      return {
        success: false,
        statusCode: 500,
        error: { code: "OTP_FAILED", message: "Failed to resend OTP" },
      } as const;
    }

    return {
      success: true,
      data: {
        ...result.data,
        otpExpiresAt: result.expiresAt,
      },
    } as const;
  },

  verifyOtp: async (input: {
    resetRequestId: string;
    otp: string;
    requestContext?: RequestContext;
  }) => {
    await otpService.handlePushTimeout({
      resetRequestId: input.resetRequestId,
      requestContext: input.requestContext,
    });

    const resetRequest = await ResetRequest.findById(input.resetRequestId);
    if (!resetRequest) {
      return {
        success: false,
        statusCode: 404,
        error: { code: "NOT_FOUND", message: "Reset request not found" },
      } as const;
    }

    if (resetRequest.status === "PENDING") {
      await auditService.logEvent({
        eventType: "reset_flow_failed",
        status: "PUSH_PENDING",
        result: "FAILURE",
        message: "OTP verify attempted before push timeout",
        metadata: { resetRequestId: resetRequest._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 409,
        error: { code: "PUSH_PENDING", message: "Push approval still pending" },
      } as const;
    }

    if (resetRequest.status === "FAILED" && resetRequest.failureReason === "AUTH_TIMEOUT") {
      return {
        success: false,
        statusCode: 409,
        error: { code: "FLOW_TIMEOUT", message: "Authentication flow timed out" },
      } as const;
    }

    const emailOtp = resetRequest.otpId
      ? await EmailOtp.findById(resetRequest.otpId)
      : await EmailOtp.findOne({ resetRequestId: resetRequest._id }).sort({ createdAt: -1 });

    if (!emailOtp) {
      await auditService.logEvent({
        eventType: "email_otp_failed",
        status: "MISSING",
        result: "FAILURE",
        message: "OTP verification attempted without OTP",
        metadata: { resetRequestId: resetRequest._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 409,
        error: { code: "NO_OTP", message: "OTP not available" },
      } as const;
    }

    if (emailOtp.status === "VERIFIED") {
      await auditService.logEvent({
        eventType: "duplicate_action",
        status: "ALREADY_VERIFIED",
        result: "SUCCESS",
        message: "Duplicate OTP verify ignored",
        metadata: { resetRequestId: resetRequest._id, otpId: emailOtp._id },
        requestContext: input.requestContext,
      });

      return {
        success: true,
        data: { status: "ALREADY_VERIFIED" },
      } as const;
    }

    if (emailOtp.status === "FAILED") {
      return {
        success: false,
        statusCode: 409,
        error: { code: "LOCKED", message: "Too many attempts" },
      } as const;
    }

    if (emailOtp.status === "EXPIRED" || isExpired(emailOtp.expiresAt)) {
      await EmailOtp.updateOne(
        { _id: emailOtp._id },
        { $set: { status: "EXPIRED" } }
      );

      await auditService.logEvent({
        eventType: "email_otp_expired",
        status: "EXPIRED",
        result: "FAILURE",
        message: "OTP expired",
        metadata: { resetRequestId: resetRequest._id, otpId: emailOtp._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 410,
        error: { code: "EXPIRED", message: "OTP expired" },
      } as const;
    }

    const isMatch = await bcrypt.compare(input.otp, emailOtp.otpHash);

    if (!isMatch) {
      emailOtp.attempts += 1;
      await emailOtp.save();

      await auditService.logEvent({
        eventType: "email_otp_failed",
        status: "INVALID",
        result: "FAILURE",
        message: "Invalid OTP",
        metadata: {
          resetRequestId: resetRequest._id,
          otpId: emailOtp._id,
          attemptCount: emailOtp.attempts,
        },
        requestContext: input.requestContext,
      });

      if (emailOtp.attempts >= OTP_MAX_ATTEMPTS) {
        emailOtp.status = "FAILED";
        await emailOtp.save();

        resetRequest.status = "FAILED";
        resetRequest.lastActivityAt = new Date();
        await resetRequest.save();

        await auditService.logEvent({
          eventType: "too_many_attempts",
          status: "OTP_FAILED",
          result: "FAILURE",
          message: "OTP attempts exceeded",
          metadata: {
            resetRequestId: resetRequest._id,
            otpId: emailOtp._id,
            attemptCount: emailOtp.attempts,
          },
          requestContext: input.requestContext,
        });
      }

      return {
        success: false,
        statusCode: 401,
        error: { code: "INVALID_OTP", message: "Invalid OTP" },
      } as const;
    }

    emailOtp.status = "VERIFIED";
    emailOtp.verifiedAt = new Date();
    await emailOtp.save();

    resetRequest.status = "OTP_VERIFIED";
    resetRequest.verificationMethod = "EMAIL_OTP";
    resetRequest.lastActivityAt = new Date();
    await resetRequest.save();

    const tokenResult = resetTokenService.signResetToken({
      userId: resetRequest.userId?.toString() ?? "",
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
      message: "Reset token issued after OTP verification",
      metadata: {
        resetRequestId: resetRequest._id,
        userId: resetRequest.userId,
        expiresAt: tokenResult.expiresAt,
      },
      requestContext: input.requestContext,
    });

    await auditService.logEvent({
      eventType: "email_otp_verified",
      status: "VERIFIED",
      result: "SUCCESS",
      message: "OTP verified",
      metadata: { resetRequestId: resetRequest._id, otpId: emailOtp._id },
      requestContext: input.requestContext,
    });

    return {
      success: true,
      data: {
        status: "VERIFIED",
        resetToken: tokenResult.token,
        resetTokenExpiresAt: tokenResult.expiresAt,
      },
    } as const;
  },

  getCooldownMs: () => OTP_RESEND_COOLDOWN_MS,
};
