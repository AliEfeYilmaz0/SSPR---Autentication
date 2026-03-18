import { Request, Response } from "express";
import { sendError } from "../utils/response";

export const notFoundHandler = (_req: Request, res: Response) => {
  return sendError(
    res,
    { code: "NOT_FOUND", message: "Route not found" },
    404
  );
};
