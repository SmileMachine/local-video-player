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
import audioRouter from "./routes/audio.js";
import { setupVite } from "./config/vite.js";
import { loggerMiddleware } from "./middleware/logger.js";
import { logger } from "./utils/logger.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const requestedPort = Number.parseInt(`${config.port}`, 10) || 3000;
const host = config.host;
const isDev = config.nodeEnv === "development";

function createAppUrl(port) {
  return `http://${host}:${port}`;
}

function listenOnAvailablePort(app, startPort) {
  return new Promise((resolve, reject) => {
    const tryListen = (port) => {
      const server = app.listen(port);

      server.once("listening", () => {
        resolve({ server, port });
      });

      server.once("error", (error) => {
        if (error.code === "EADDRINUSE") {
          logger.warn(`Port ${port} is already in use, trying ${port + 1}`);
          tryListen(port + 1);
          return;
        }

        reject(error);
      });
    };

    tryListen(startPort);
  });
}

async function createServer() {
  // Enable cors
  app.use(cors());

  // Parse JSON request bodies
  app.use(express.json());

  // Mount the routes
  app.use("/video", videoRouter);
  app.use("/audio", audioRouter);
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

  try {
    const { port } = await listenOnAvailablePort(app, requestedPort);
    const appUrl = createAppUrl(port);

    logger.success(`App is running at ${appUrl}`);
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
}

createServer();
