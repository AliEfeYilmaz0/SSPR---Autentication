import express from "express";
import { requestContext } from "./middleware/requestContext";
import { notFoundHandler } from "./middleware/notFoundHandler";
import { errorHandler } from "./middleware/errorHandler";
import { sendSuccess } from "./utils/response";
import ssprRoutes from "./routes/ssprRoutes";
import authenticatorRoutes from "./routes/authenticatorRoutes";
import auditRoutes from "./routes/auditRoutes";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", true);
  app.use(express.json());
  app.use(requestContext);

  app.get("/health", (req, res) => {
    return sendSuccess(res, "ok", {
      requestId: req.context?.requestId,
    });
  });

  app.use("/api/sspr", ssprRoutes);
  app.use("/api/authenticator", authenticatorRoutes);
  app.use("/api", auditRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
