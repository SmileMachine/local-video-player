import express from "express";
import fs from "fs";
import { useVideoLibrary } from "../services/videoLibrary.js";
import {
  getDPlayerDanmaku,
  getDanmakuStatus,
  importBilibiliDanmaku,
} from "../services/danmakuFiles.js";
import { logger } from "../utils/logger.js";

const router = express.Router();
const videoLibrary = useVideoLibrary();

const resolveVideoPath = (id) => {
  const decodedId = decodeURIComponent(id || "");
  return videoLibrary.getIdMap()[decodedId] || "";
};

router.get("/status", async (req, res) => {
  try {
    const videoId = String(req.query.id || "");
    const videoPath = resolveVideoPath(videoId);
    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.json({
        exists: false,
        fileName: "",
        message: "Video not found",
      });
    }

    res.json(await getDanmakuStatus(videoPath, { videoId }));
  } catch (error) {
    logger.error("Error checking danmaku status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/v3/", async (req, res) => {
  try {
    const videoId = String(req.query.id || "");
    const videoPath = resolveVideoPath(videoId);
    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.json({ code: 0, data: [] });
    }

    res.json(await getDPlayerDanmaku(videoPath, { videoId }));
  } catch (error) {
    logger.error("Error serving danmaku:", error);
    res.status(500).json({ code: 1, msg: "Internal server error" });
  }
});

router.post("/import", async (req, res) => {
  try {
    const videoId = String(req.body?.id || "");
    const videoPath = resolveVideoPath(videoId);
    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.status(404).json({ error: "Video not found" });
    }

    const result = await importBilibiliDanmaku(videoPath, {
      bvid: req.body?.bvid,
      page: req.body?.page,
      videoId,
    });
    res.json(result);
  } catch (error) {
    logger.error("Error importing bilibili danmaku:", error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Internal server error",
    });
  }
});

router.post("/v3/", (req, res) => {
  res.status(405).json({
    code: 1,
    msg: "Danmaku writing is not supported",
  });
});

export default router;
