import { RequestContext } from "../requestContext";

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

export {};
