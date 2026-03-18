import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { RequestContext } from "../types/requestContext";

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = crypto.randomUUID();
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";

  const context: RequestContext = {
    requestId,
    ip,
    userAgent,
  };

  req.context = context;
  res.setHeader("X-Request-Id", requestId);
  next();
};
