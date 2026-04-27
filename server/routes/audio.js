import express from "express";
import fs from "fs";
import { loggerMiddleware } from "../middleware/logger.js";
import { useConfig } from "../utils/config.js";
import { useVideoLibrary } from "../services/videoLibrary.js";
import {
  ensureCompatibleAudio,
  getAudioCachePath,
  getCompatibleAudioStatus,
} from "../services/audioCache.js";
import { logger } from "../utils/logger.js";

const router = express.Router();
const videoLibrary = useVideoLibrary();

const resolveVideoPath = async (req) => {
  const { usePathIds } = (await useConfig()).getConfig();
  if (usePathIds) {
    return videoLibrary.getIdMap()[decodeURIComponent(req.query.id || "")];
  }
  return decodeURIComponent(req.query.path || "");
};

const buildAudioUrl = (req) => {
  if (req.query.id) {
    return `/audio?id=${encodeURIComponent(req.query.id)}`;
  }
  if (req.query.path) {
    return `/audio?path=${encodeURIComponent(req.query.path)}`;
  }
  return "";
};

const buildCachedAudioUrl = (key) => `/audio/cache/${encodeURIComponent(key)}.m4a`;

const sendAudioFile = (req, res, filePath) => {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = Number.parseInt(parts[0], 10);
    const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "audio/mp4",
    });
    file.pipe(res);
    return;
  }

  res.writeHead(200, {
    "Accept-Ranges": "bytes",
    "Content-Length": fileSize,
    "Content-Type": "audio/mp4",
  });
  fs.createReadStream(filePath).pipe(res);
};

router.get("/status", loggerMiddleware, async (req, res) => {
  try {
    const filePath = await resolveVideoPath(req);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Video not found" });
    }

    let status = await getCompatibleAudioStatus(filePath);
    if (status.enabled && status.needed && !status.exists) {
      const descriptor = await ensureCompatibleAudio(filePath);
      status = {
        key: descriptor.key,
        enabled: descriptor.enabled,
        needed: descriptor.needed,
        exists: true,
        audioInfo: descriptor.audioInfo,
        output: descriptor.output,
      };
    }

    res.json({
      ...status,
      url: status.enabled && status.needed && status.key
        ? buildCachedAudioUrl(status.key)
        : buildAudioUrl(req),
    });
  } catch (error) {
    logger.error("Error checking compatible audio status:", error);
    res.status(500).json({ error: "Failed to check compatible audio status" });
  }
});

router.get("/cache/:fileName", loggerMiddleware, async (req, res) => {
  try {
    const key = String(req.params.fileName || "").replace(/\.m4a$/i, "");
    const filePath = await getAudioCachePath(key);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send("Audio cache not found");
    }

    sendAudioFile(req, res, filePath);
  } catch (error) {
    logger.error("Error serving cached compatible audio:", error);
    res.status(500).send("Failed to serve cached compatible audio");
  }
});

router.get("/", loggerMiddleware, async (req, res) => {
  try {
    const filePath = await resolveVideoPath(req);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send("Video not found");
    }

    const descriptor = await ensureCompatibleAudio(filePath);
    sendAudioFile(req, res, descriptor.filePath);
  } catch (error) {
    logger.error("Error serving compatible audio:", error);
    res.status(error.statusCode || 500).send(error.message || "Failed to serve compatible audio");
  }
});

export default router;
