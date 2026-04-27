import express from "express";
import fs from "fs";
import { useVideoLibrary } from "../services/videoLibrary.js";
import {
  getCaptionTrackFile,
  getCaptionTracks,
  getCombinedCaptionFile,
} from "../services/captionCache.js";
import { logger } from "../utils/logger.js";

const router = express.Router();
const videoLibrary = useVideoLibrary();

const resolveVideoRequest = (id) => {
  const decodedId = decodeURIComponent(id || "");
  return {
    videoPath: videoLibrary.getIdMap()[decodedId],
    mediaInfo: videoLibrary.getInfoMap()[decodedId] || null,
  };
};

const sendVttFile = (res, filePath) => {
  res.setHeader("Content-Type", "text/vtt; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  fs.createReadStream(filePath).pipe(res);
};

router.get("/status", async (req, res) => {
  try {
    const { videoPath, mediaInfo } = resolveVideoRequest(req.query.id);
    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.json({
        exists: false,
        tracks: [],
        defaultTrackId: "",
        message: "Video not found",
      });
    }

    res.json(await getCaptionTracks(videoPath, mediaInfo));
  } catch (error) {
    logger.error("Error checking caption status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { videoPath, mediaInfo } = resolveVideoRequest(req.query.id);
    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.status(404).send("Caption not found");
    }

    const mode = String(req.query.mode || "single").toLowerCase();
    const filePath = mode === "combined"
      ? await getCombinedCaptionFile(
          videoPath,
          String(req.query.primary || ""),
          String(req.query.secondary || ""),
          mediaInfo
        )
      : await getCaptionTrackFile(videoPath, String(req.query.track || ""), mediaInfo);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send("No subtitles found");
    }

    sendVttFile(res, filePath);
  } catch (error) {
    logger.error("Error serving caption:", error);
    if (!res.headersSent) {
      res.status(error.statusCode || 500).send(error.message || "Internal server error");
    }
  }
});

export default router;
