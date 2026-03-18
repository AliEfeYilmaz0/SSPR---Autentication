import { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/response";
import { isDev } from "../config/env";

type ErrorWithStatus = Error & {
  statusCode?: number;
  code?: string;
};

export const errorHandler = (
  err: ErrorWithStatus,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.statusCode ?? 500;
  const code = err.code ?? "INTERNAL_ERROR";
  const message = status >= 500 && !isDev ? "Internal server error" : err.message;

  console.error("[error]", err);

  return sendError(res, { code, message }, status);
};
