import { Request, Response } from "express";
import { sendError, sendSuccess } from "../utils/response";
import { ssprService } from "../services/ssprService";
import { otpService } from "../services/otpService";
import { Types } from "mongoose";
import { resetService } from "../services/resetService";

export const ssprController = {
  requestReset: async (req: Request, res: Response) => {
    const usernameOrEmail = String(req.body?.usernameOrEmail ?? "").trim();

    if (!usernameOrEmail) {
      return sendError(
        res,
        { code: "VALIDATION_ERROR", message: "usernameOrEmail is required" },
        400
      );
    }

    const result = await ssprService.requestReset({
      usernameOrEmail,
      requestContext: req.context,
    });

    return sendSuccess(res, "If an account exists, a reset request was created.", {
      resetRequestId: result?.resetRequestId,
    });
  },

  getStatus: async (req: Request, res: Response) => {
    const resetRequestId = String(req.params.resetRequestId ?? "").trim();
    if (!Types.ObjectId.isValid(resetRequestId)) {
      return sendError(
        res,
        { code: "VALIDATION_ERROR", message: "Invalid resetRequestId" },
        400
      );
    }

    const result = await ssprService.getStatus({
      resetRequestId,
      requestContext: req.context,
    });

    if (!result.success) {
      return sendError(res, result.error, result.statusCode);
    }

    return sendSuccess(res, "status", result.data);
  },

  verifyOtp: async (req: Request, res: Response) => {
    const resetRequestId = String(req.body?.resetRequestId ?? "").trim();
    const otp = String(req.body?.otp ?? "").trim();

    if (!Types.ObjectId.isValid(resetRequestId) || !otp) {
      return sendError(
        res,
        { code: "VALIDATION_ERROR", message: "resetRequestId and otp are required" },
        400
      );
    }

    const result = await otpService.verifyOtp({
      resetRequestId,
      otp,
      requestContext: req.context,
    });

    if (!result.success) {
      return sendError(res, result.error, result.statusCode);
    }

    return sendSuccess(res, "OTP verified", result.data);
  },

  resendOtp: async (req: Request, res: Response) => {
    const resetRequestId = String(req.body?.resetRequestId ?? "").trim();

    if (!Types.ObjectId.isValid(resetRequestId)) {
      return sendError(
        res,
        { code: "VALIDATION_ERROR", message: "resetRequestId is required" },
        400
      );
    }

    const result = await otpService.resendOtp({
      resetRequestId,
      requestContext: req.context,
    });

    if (!result.success) {
      return sendError(res, result.error, result.statusCode);
    }

    return sendSuccess(res, "OTP sent", result.data);
  },

  validateResetToken: async (req: Request, res: Response) => {
    const token = String(req.body?.token ?? "").trim();
    if (!token) {
      return sendError(
        res,
        { code: "VALIDATION_ERROR", message: "token is required" },
        400
      );
    }

    const result = await resetService.validateResetToken({
      token,
      requestContext: req.context,
    });

    if (!result.success) {
      return sendError(res, result.error, result.statusCode);
    }

    return sendSuccess(res, "token valid", result.data);
  },

  resetPassword: async (req: Request, res: Response) => {
    const token = String(req.body?.token ?? "").trim();
    const newPassword = String(req.body?.newPassword ?? "");
    const confirmPassword = String(req.body?.confirmPassword ?? "");

    if (!token || !newPassword || !confirmPassword) {
      return sendError(
        res,
        { code: "VALIDATION_ERROR", message: "token, newPassword, confirmPassword are required" },
        400
      );
    }

    const result = await resetService.resetPassword({
      token,
      newPassword,
      confirmPassword,
      requestContext: req.context,
    });

    if (!result.success) {
      return sendError(res, result.error, result.statusCode);
    }

    return sendSuccess(res, "Password changed", result.data);
  },
};
