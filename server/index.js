import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import "dotenv/config"; // Load .env file

import config from "./config/server.js";
import videoRouter from "./routes/video.js";
import apiRouter from "./routes/api.js";
import captionRouter from "./routes/caption.js";
import { setupVite } from "./config/vite.js";
import { loggerMiddleware } from "./middleware/logger.js";
import { logger } from "./utils/logger.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = config.port;
const host = config.host;
const isDev = config.nodeEnv === "development";

async function createServer() {
  // Enable cors
  app.use(cors());

  // Mount the routes
  app.use("/video", videoRouter);
  app.use("/api", apiRouter);
  app.use("/caption", captionRouter);

  // Setup Vite
  await setupVite(app, isDev);

  // SPA route handling
  app.get("*", loggerMiddleware, (req, res) => {
    if (isDev) {
      res.sendFile(path.join(__dirname, "../index.html"));
    } else {
      res.sendFile(path.join(__dirname, "../dist/index.html"));
    }
  });

  // Start the server
  app.listen(port, () => {
    logger.info(`Server running at http://${host}:${port}`);
  });
}

createServer();
