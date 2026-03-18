import bcrypt from "bcrypt";
import { ResetRequest } from "../models/ResetRequest";
import { User } from "../models/User";
import { auditService } from "./auditService";
import { resetTokenService } from "./resetTokenService";
import { validatePasswordPolicy } from "../utils/passwordPolicy";
import { RequestContext } from "../types/requestContext";
import { flowTimeoutService } from "./flowTimeoutService";

const PASSWORD_SALT_ROUNDS = 12;

const validateResetTokenInternal = async (input: {
  token: string;
  requestContext?: RequestContext;
}) => {
  const tokenCheck = resetTokenService.verifyResetToken(input.token);

  if (!tokenCheck.valid) {
    const reason = tokenCheck.reason === "EXPIRED" ? "EXPIRED" : "INVALID";
    await auditService.logEvent({
      eventType: tokenCheck.reason === "EXPIRED" ? "reset_token_expired" : "reset_token_invalid",
      status: reason,
      result: "FAILURE",
      message: "Reset token invalid or expired",
      metadata: { reason },
      requestContext: input.requestContext,
    });

    return {
      success: false,
      statusCode: 401,
      error: { code: "INVALID_TOKEN", message: "Reset token is invalid or expired" },
    } as const;
  }

  const payload = tokenCheck.payload;
  const resetRequest = await ResetRequest.findById(payload.resetRequestId);

  if (!resetRequest) {
    await auditService.logEvent({
      eventType: "reset_token_invalid",
      status: "NO_REQUEST",
      result: "FAILURE",
      message: "Reset token used with missing request",
      metadata: { resetRequestId: payload.resetRequestId },
      requestContext: input.requestContext,
    });

    return {
      success: false,
      statusCode: 404,
      error: { code: "NOT_FOUND", message: "Reset request not found" },
    } as const;
  }

  const timeoutCheck = await flowTimeoutService.ensureResetFlowTimeout({
    resetRequestId: resetRequest._id.toString(),
    requestContext: input.requestContext,
  });

  if (timeoutCheck?.status === "FAILED" && timeoutCheck.failureReason === "RESET_TIMEOUT") {
    return {
      success: false,
      statusCode: 409,
      error: { code: "FLOW_TIMEOUT", message: "Reset flow timed out" },
    } as const;
  }

  if (resetRequest.status === "COMPLETED") {
    await auditService.logEvent({
      eventType: "duplicate_action",
      status: "COMPLETED",
      result: "SUCCESS",
      message: "Password reset attempted on completed request",
      metadata: { resetRequestId: resetRequest._id },
      requestContext: input.requestContext,
    });

    return {
      success: false,
      statusCode: 409,
      error: { code: "COMPLETED", message: "Reset already completed" },
    } as const;
  }

  if (resetRequest.status === "FAILED" || resetRequest.status === "PUSH_DENIED") {
    await auditService.logEvent({
      eventType: "reset_flow_failed",
      status: "INVALID_STATE",
      result: "FAILURE",
      message: "Password reset attempted in invalid state",
      metadata: { resetRequestId: resetRequest._id, status: resetRequest.status },
      requestContext: input.requestContext,
    });

    return {
      success: false,
      statusCode: 409,
      error: { code: "INVALID_STATE", message: "Reset not allowed" },
    } as const;
  }

  if (!resetRequest.resetTokenJti || resetRequest.resetTokenJti !== payload.jti) {
    await auditService.logEvent({
      eventType: "reset_token_invalid",
      status: "JTI_MISMATCH",
      result: "FAILURE",
      message: "Reset token does not match latest issuance",
      metadata: { resetRequestId: resetRequest._id },
      requestContext: input.requestContext,
    });

    return {
      success: false,
      statusCode: 401,
      error: { code: "INVALID_TOKEN", message: "Reset token is invalid" },
    } as const;
  }

  if (resetRequest.resetTokenExpiresAt && resetRequest.resetTokenExpiresAt < new Date()) {
    await auditService.logEvent({
      eventType: "reset_token_expired",
      status: "EXPIRED",
      result: "FAILURE",
      message: "Reset token expired",
      metadata: { resetRequestId: resetRequest._id },
      requestContext: input.requestContext,
    });

    return {
      success: false,
      statusCode: 401,
      error: { code: "EXPIRED", message: "Reset token expired" },
    } as const;
  }

  return {
    success: true,
    resetRequest,
    payload,
  } as const;
};

export const resetService = {
  validateResetToken: async (input: { token: string; requestContext?: RequestContext }) => {
    const result = await validateResetTokenInternal(input);
    if (!result.success) return result;

    return {
      success: true,
      data: {
        usernameOrEmail: result.resetRequest.usernameOrEmail,
        resetRequestId: result.resetRequest._id,
      },
    } as const;
  },

  resetPassword: async (input: {
    token: string;
    newPassword: string;
    confirmPassword: string;
    requestContext?: RequestContext;
  }) => {
    const result = await validateResetTokenInternal({
      token: input.token,
      requestContext: input.requestContext,
    });

    if (!result.success) {
      return result;
    }

    const resetRequest = result.resetRequest;

    if (input.newPassword !== input.confirmPassword) {
      await auditService.logEvent({
        eventType: "password_change_failed",
        status: "MISMATCH",
        result: "FAILURE",
        message: "Password confirmation mismatch",
        metadata: { resetRequestId: resetRequest._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 400,
        error: { code: "PASSWORD_MISMATCH", message: "Passwords do not match" },
      } as const;
    }

    const policyCheck = validatePasswordPolicy(input.newPassword);
    if (!policyCheck.valid) {
      await auditService.logEvent({
        eventType: "password_policy_failed",
        status: "POLICY_FAIL",
        result: "FAILURE",
        message: "Password policy failed",
        metadata: { resetRequestId: resetRequest._id, reasons: policyCheck.errors },
        requestContext: input.requestContext,
      });

      await auditService.logEvent({
        eventType: "password_change_failed",
        status: "POLICY_FAIL",
        result: "FAILURE",
        message: "Password change failed due to policy",
        metadata: { resetRequestId: resetRequest._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 422,
        error: { code: "POLICY_FAIL", message: "Password policy requirements not met" },
      } as const;
    }

    const user = resetRequest.userId
      ? await User.findById(resetRequest.userId)
      : null;

    if (!user) {
      await auditService.logEvent({
        eventType: "password_change_failed",
        status: "NO_USER",
        result: "FAILURE",
        message: "Password change failed; user not found",
        metadata: { resetRequestId: resetRequest._id },
        requestContext: input.requestContext,
      });

      return {
        success: false,
        statusCode: 404,
        error: { code: "NOT_FOUND", message: "User not found" },
      } as const;
    }

    const passwordHash = await bcrypt.hash(input.newPassword, PASSWORD_SALT_ROUNDS);
    user.passwordHash = passwordHash;
    await user.save();

    resetRequest.status = "COMPLETED";
    resetRequest.completedAt = new Date();
    resetRequest.lastActivityAt = new Date();
    resetRequest.resetTokenJti = undefined;
    resetRequest.resetTokenExpiresAt = undefined;
    await resetRequest.save();

    await auditService.logEvent({
      eventType: "password_changed",
      status: "COMPLETED",
      result: "SUCCESS",
      message: "Password changed successfully",
      metadata: { resetRequestId: resetRequest._id, userId: user._id },
      requestContext: input.requestContext,
    });

    await auditService.logEvent({
      eventType: "reset_flow_completed",
      status: "COMPLETED",
      result: "SUCCESS",
      message: "Reset flow completed",
      metadata: { resetRequestId: resetRequest._id },
      requestContext: input.requestContext,
    });

    return {
      success: true,
      data: { resetRequestId: resetRequest._id },
    } as const;
  },
};
