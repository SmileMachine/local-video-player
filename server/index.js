import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import 'dotenv/config'  // 自动加载 .env 文件

import videoRouter from "./routes/video.js";
import apiRouter from "./routes/api.js";
import { setupVite } from "./config/vite.js";
import { loggerMiddleware } from "./middleware/logger.js";
import config from "./config/server.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = config.port;
const host = config.host;
const isDev = config.nodeEnv === "development";

async function createServer() {
  app.use(cors());

  // 挂载路由
  app.use("/video", videoRouter);
  app.use("/api", apiRouter);

  // 设置 Vite
  await setupVite(app, isDev);

  // SPA 路由处理
  app.get("*", loggerMiddleware, (req, res) => {
    if (isDev) {
      res.sendFile(path.join(__dirname, "../index.html"));
    } else {
      res.sendFile(path.join(__dirname, "../dist/index.html"));
    }
  });

  app.listen(port, () => {
    console.log(`Server running at http://${host}:${port}`);
  });
}

createServer();
