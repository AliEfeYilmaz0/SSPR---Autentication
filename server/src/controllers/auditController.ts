import { Request, Response } from "express";
import { sendError, sendSuccess } from "../utils/response";
import { auditQueryService } from "../services/auditQueryService";

export const auditController = {
  getLogs: async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const eventType = String(req.query.eventType ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const usernameOrEmail = String(req.query.usernameOrEmail ?? "").trim();
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();

    if (Number.isNaN(page) || Number.isNaN(limit)) {
      return sendError(
        res,
        { code: "VALIDATION_ERROR", message: "Invalid page or limit" },
        400
      );
    }

    const result = await auditQueryService.queryLogs({
      page,
      limit,
      eventType: eventType || undefined,
      status: status || undefined,
      usernameOrEmail: usernameOrEmail || undefined,
      from: from || undefined,
      to: to || undefined,
    });

    if (!result.success) {
      return sendError(res, result.error, result.statusCode);
    }

    return sendSuccess(res, "audit logs", result.data);
  },
};
