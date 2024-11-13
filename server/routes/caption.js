import express from "express";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import srt2vtt from "srt-to-vtt";
import { pipeline } from "stream/promises";
import { useVideoLibrary } from "../services/videoLibrary.js";
import { logger } from "../utils/logger.js";

const router = express.Router();
const videoLibrary = useVideoLibrary();

function getBasePath(videoPath) {
  return videoPath.split('.').slice(0, -1).join('.'); // 移除 .mp4 后缀
}

// 检查字幕状态的API
router.get("/status", async (req, res) => {
  try {
    const videoPath = videoLibrary.getIdMap()[decodeURIComponent(req.query.id)];
    if (!videoPath) {
      return res.json({ exists: false, message: "Video not found" });
    }

    const basePath = getBasePath(videoPath);
    const vttPath = basePath + ".vtt";
    const srtPath = basePath + ".srt";

    if (fs.existsSync(vttPath)) {
      return res.json({ exists: true, format: "vtt" });
    }

    if (fs.existsSync(srtPath)) {
      return res.json({ exists: true, format: "srt" });
    }

    return res.json({ exists: false, message: "No subtitles found" });
  } catch (error) {
    logger.error("Error checking caption status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 获取字幕内容的API
router.get("/", async (req, res) => {
  try {
    logger.debug(`req.query.id: ${req.query.id}`);
    const videoPath = videoLibrary.getIdMap()[decodeURIComponent(req.query.id)];
    if (!videoPath) {
      return res.status(404).send("Caption not found");
    }

    const basePath = getBasePath(videoPath);
    const vttPath = basePath + ".vtt";
    const srtPath = basePath + ".srt";

    // 如果VTT存在，直接返回
    if (fs.existsSync(vttPath)) {
      res.setHeader("Content-Type", "text/vtt");
      return fs.createReadStream(vttPath).pipe(res);
    }

    // 如果SRT存在，转换后返回
    if (fs.existsSync(srtPath)) {
      res.setHeader("Content-Type", "text/vtt");
      
      // 实时转换并返回
      const srtStream = fs.createReadStream(srtPath);
      const vttConverter = srt2vtt();
      
      try {
        await pipeline(srtStream, vttConverter, res);
      } catch (error) {
        logger.error("Error converting srt to vtt:", error);
        if (!res.headersSent) {
          res.status(500).send("Error converting subtitles");
        }
      }
      return;
    }

    // 没有找到字幕文件
    res.status(404).send("No subtitles found");
  } catch (error) {
    logger.error("Error serving caption:", error);
    if (!res.headersSent) {
      res.status(500).send("Internal server error");
    }
  }
});

export default router;
