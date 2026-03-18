import { Request, Response } from "express";
import { sendError, sendSuccess } from "../utils/response";
import { authenticatorService } from "../services/authenticatorService";

export const authenticatorController = {
  getPending: async (_req: Request, res: Response) => {
    const challenges = await authenticatorService.getPending();
    return sendSuccess(res, "pending challenges", { challenges });
  },

  approve: async (req: Request, res: Response) => {
    const challengeId = String(req.body?.challengeId ?? "").trim();

    if (!challengeId) {
      return sendError(
        res,
        { code: "VALIDATION_ERROR", message: "challengeId is required" },
        400
      );
    }

    const result = await authenticatorService.approveChallenge({
      challengeId,
      requestContext: req.context,
    });

    if (!result.success) {
      return sendError(res, result.error, result.statusCode);
    }

    return sendSuccess(res, result.message, result.data);
  },

  deny: async (req: Request, res: Response) => {
    const challengeId = String(req.body?.challengeId ?? "").trim();

    if (!challengeId) {
      return sendError(
        res,
        { code: "VALIDATION_ERROR", message: "challengeId is required" },
        400
      );
    }

    const result = await authenticatorService.denyChallenge({
      challengeId,
      requestContext: req.context,
    });

    if (!result.success) {
      return sendError(res, result.error, result.statusCode);
    }

    return sendSuccess(res, result.message, result.data);
  },
};
