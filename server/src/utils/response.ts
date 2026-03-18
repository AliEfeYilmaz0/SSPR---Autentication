import { Response } from "express";

type ErrorPayload = {
  code: string;
  message: string;
};

export const sendSuccess = (
  res: Response,
  message: string,
  data: Record<string, unknown> = {},
  status = 200
) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  error: ErrorPayload,
  status = 400
) => {
  return res.status(status).json({
    success: false,
    error,
  });
};
