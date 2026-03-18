import { createApp } from "./app";
import { connectToDatabase } from "./config/db";
import { env } from "./config/env";

const startServer = async () => {
  try {
    await connectToDatabase();
    const app = createApp();
    app.listen(env.port, () => {
      console.log(`[server] listening on port ${env.port}`);
    });
  } catch (error) {
    console.error("[server] failed to start", error);
    process.exit(1);
  }
};

startServer();
